import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabaseClient } from '@/common/helpers/supabase';


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
  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
            Sign in to your herocast account
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Auth
            supabaseClient={supabaseClient}
            providers={[]}
            appearance={appearance}
          />
        </div>
      </div>
    </>
  )
}
