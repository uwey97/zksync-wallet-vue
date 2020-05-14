import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { DataList } from 'components/DataList/DataListNew';
import MyWallet from 'components/Wallets/MyWallet';
import SpinnerWorm from 'components/Spinner/SpinnerWorm';

import { useTransaction } from 'hooks/useTransaction';
import { useCheckLogin } from 'src/hooks/useCheckLogin';
import { useCancelable } from 'hooks/useCancelable';
import { loadTokens } from 'src/utils';
import Spinner from 'src/components/Spinner/Spinner';
import { useStore } from 'src/store/context';
import { useMobxEffect } from 'src/hooks/useMobxEffect';

const Account: React.FC = observer(() => {
  const { setMaxValueProp, setSymbolNameProp, setTokenProp } = useTransaction();

  const history = useHistory();
  const store = useStore();

  const cancelable = useCancelable();

  const refreshBalances = useCallback(async () => {
    const {
      zkWallet,
      syncProvider,
      syncWallet,
      accountState,
      zkBalances,
      tokens,
      verified,
    } = store;

    if (zkWallet && syncProvider && syncWallet && accountState) {
      await cancelable(loadTokens(syncProvider, syncWallet, accountState)).then(
        async res => {
          const { accountState } = store;

          if (JSON.stringify(zkBalances) !== JSON.stringify(res.zkBalances)) {
            store.zkBalances = res.zkBalances;
            store.searchBalances = res.zkBalances;

            if (accountState?.id) {
              zkWallet?.isSigningKeySet().then(data => {
                store.unlocked = data;
              });
            } else {
              store.unlocked = true;
            }
            store.searchBalances = zkBalances;
          }
          if (JSON.stringify(tokens) !== JSON.stringify(res.tokens)) {
            store.tokens = res.tokens;
          }
        },
      );
    }
  }, [cancelable, store]);

  useEffect(() => {
    const { zkWallet, accountState } = store;
    if (!zkWallet) return;
    let t: number | undefined;
    const refreshRec = () => {
      refreshBalances().then(() => {
        t = setTimeout(refreshRec, 2000) as any;
      });
    };
    refreshRec();

    const getAccState = async () => {
      if (zkWallet) {
        store.accountState = await zkWallet.getAccountState();
      }
    };
    const int = setInterval(getAccState, 5000);
    if (
      JSON.stringify(accountState?.verified.balances) !==
      JSON.stringify(store.verified)
    ) {
      store.verified = accountState?.verified.balances;
    }

    return () => {
      clearInterval(int);
      if (t !== undefined) {
        clearTimeout(t);
      }
    };
  }, [
    store,
    store.zkWallet,
    store.verified,
    store.zkBalances,
    store.accountState,
    refreshBalances,
  ]);

  const handleSend = useCallback(
    (address, balance, symbol) => {
      store.transactionType = 'transfer';
      history.push('/send');
      setMaxValueProp(balance);
      setSymbolNameProp(symbol);
      setTokenProp(symbol ? symbol : address);
    },
    [history, setMaxValueProp, setSymbolNameProp, setTokenProp, store],
  );

  useCheckLogin();

  const isVerified = ({ address, symbol, balance }) => {
    return (
      store.verified &&
      (+balance === +store.verified[address] / Math.pow(10, 18) ||
        +balance === +store.verified[symbol] / Math.pow(10, 18))
    );
  };

  const { ethBalances, price, zkBalances, zkBalancesLoaded } = store;
  const ApiFailedHint = () =>
    !store.price && store.zkBalancesLoaded ? (
      <p>{'No Conversion Rate Available'}</p>
    ) : null;

  const VerifiedBal = ({ balance: { address, symbol, balance } }) => (
    <div key={balance} className='balances-token verified'>
      <div className='balances-token-left'>
        {'zk'}
        {symbol}
      </div>
      <div className='balances-token-right'>
        <p>{+balance < 0.000001 ? 0 : +balance.toFixed(6)}</p>{' '}
        {price && (
          <span>
            {`(~$${+(
              balance * +(price && !!price[symbol] ? price[symbol] : 1)
            ).toFixed(2)})`}
          </span>
        )}
        <div className='balances-token-status'>
          <p>{'Verified'}</p>
          <span className='label-done'></span>
        </div>
        <button
          className='btn-tr'
          onClick={() => handleSend(address, balance, symbol)}
        >
          {'Send'}
        </button>
      </div>
    </div>
  );
  const UnverifiedBal = ({ balance: { address, symbol, balance } }) => (
    <div key={balance} className='balances-token pending'>
      <div className='balances-token-left'>
        {'zk'}
        {symbol}
      </div>
      <div className='balances-token-right'>
        <p>{+balance < 0.000001 ? 0 : +balance.toFixed(6)}</p>{' '}
        {price?.length && (
          <span>{`(~$${+(
            balance * +(price && !!price[symbol] ? price[symbol] : 1)
          ).toFixed(2)})`}</span>
        )}
        <div className='balances-token-status'>
          <p>{'Verifying'}</p>
          <SpinnerWorm />
        </div>
        <button
          onClick={() => handleSend(address, balance, symbol)}
          className='pending btn-tr'
        >
          {'Send'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <MyWallet
        balances={ethBalances}
        price={price}
        title='zkSync Wallet'
        setTransactionType={t => {
          store.transactionType = t;
        }}
      />
      <DataList
        data={zkBalances}
        title='Token balances'
        visible={true}
        footer={ApiFailedHint}
        renderItem={balance =>
          isVerified(balance) ? (
            <VerifiedBal key={balance.address} balance={balance} />
          ) : (
            <UnverifiedBal key={balance.address} balance={balance} />
          )
        }
        emptyListComponent={() =>
          zkBalancesLoaded ? <p>{'No balances yet.'}</p> : <Spinner />
        }
      />
    </>
  );
});

export default Account;
