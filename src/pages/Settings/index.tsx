import { supabaseClient } from "@/common/helpers/supabase";
import React from "react";


export default function Settings() {

  const onLogout = async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession()

    if (session) {
      await supabaseClient.auth.signOut()
    }
  }

  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-white mb-8">Settings</span>
      <button
        type="button"
        onSubmit={() => onLogout()}
        className="inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
      >
        Logout
      </button>
    </div>
  )
}
