import React, { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Session } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
// import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabaseClient } from '../helpers/supabase'
import { useNavigationStore } from "@/stores/useNavigationStore";


export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      console.log(`LoginModal getSession`, session)
      setSession(session)
      setOpen(!session)
    })

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      console.log(`LoginModal onAuthStateChange`, session)
      setSession(session)
      setOpen(!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // useEffect(() => {
  //   if (session) {
  //     hydrate().then(() => toFeed());
  //   }
  // }, [session])

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => null}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-10"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-10"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-800 bg-opacity-90 transition-opacity" />
        </Transition.Child>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-20"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-20"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="text-white relative transform overflow-hidden rounded-sm bg-gray-900 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <Dialog.Title
                  as="h3"
                  className="text-lg mb-6 leading-6 font-lg text-white"
                >
                  <div className="flex items-center justify-center">
                    <span className="ml-3">Welcome to herocast</span>
                  </div>
                </Dialog.Title>
                <Auth
                  supabaseClient={supabaseClient}
                  providers={[]}
                  // theme="dark"
                  appearance={{
                    extend: true,
                    // theme: ThemeSupa,
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
                  }}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
