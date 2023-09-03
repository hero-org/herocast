import React, { useEffect, useState } from 'react'
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabaseClient } from '@/common/helpers/supabase';
import { Session } from '@supabase/supabase-js';
import { hydrate } from '@/stores/useAccountStore';
import { useNavigate, useLocation } from "react-router-dom";
import get from 'lodash.get';

const appearance = {
  extend: true,
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: 'rgb(16 185 129)',
        brandAccent: 'rgb(5 150 105)',
        inputBorder: '#F3F4F6',
        inputBorderHover: 'rgb(229 231 235)',
        inputBorderFocus: 'rgb(229 231 235)',
        inputText: '#F3F4F6',
        inputLabelText: '#F3F4F6',
        inputPlaceholder: '#F3F4F6',
        messageText: '#c2410c',
        messageTextDanger: '#b45309',
        anchorTextColor: '#6b7280',
        anchorTextHoverColor: '#d1d5db',
      },
      radii: {
        borderRadiusButton: '2px',
        buttonBorderRadius: '2px',
        inputBorderRadius: '2px',
      },
    },
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);


  const { hash } = useLocation();
  const queryParams = hash
    .substring(1)
    .split('&')
    .reduce((acc, curr) => {
      const [key, value] = curr.split('=');
      return { ...acc, [key]: value };
    }, {});

  const requestType = get(queryParams, 'type');
  console.log('Login queryParams.type', requestType);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      console.log(`Login getSession`, session)
    })

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log(`Login onAuthStateChange`, event, session)

      if (event === 'PASSWORD_RECOVERY') {
        console.log('new pw being set')
      } else if (event === 'USER_UPDATED' || session) {
        console.log('Login onAuthStateChange hasSession - hydrate and navigate');
        setIsLoading(true);
        hydrate();
        setIsLoading(false);
        navigate('/feed');
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white font-semibold">
            Sign in
          </h2>
        </div>
        {isLoading && (<span className="my-4 font-semibold text-gray-200">Loading...</span>)}
        <div className="text-white text-lg mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Auth
            supabaseClient={supabaseClient}
            providers={[]}
            appearance={appearance}
            queryParams={queryParams}
          />
        </div>
      </div>
    </>
  )
}
