const AccountsRightSidebar = () => {
  const accounts = [];

  return <aside className="bg-black/10 lg:fixed lg:bottom-0 lg:right-0 lg:top-20 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <header className="flex items-center justify-between border-y border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <h2 className="text-base font-semibold leading-7 text-white">Accounts</h2>
      <a href="#" className="text-sm font-semibold leading-6 text-indigo-400">
        View all
      </a>
    </header>
    <ul role="list" className="divide-y divide-white/5">
      {accounts.map((item) => (
        <li key={item.publicKey} className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-x-3">
            {/* <img src={item.user.imageUrl} alt="" className="h-6 w-6 flex-none rounded-full bg-gray-800" /> */}
            <h3 className="flex-auto truncate text-sm font-semibold leading-6 text-white">{item.username}</h3>
            {/* <span dateTime={item.timestamp} className="flex-none text-xs text-gray-600">
              {item.timestamp}
            </span> */}
          </div>
          <p className="mt-2 truncate text-sm text-gray-500">
            login on <span className="text-gray-400">{item.timestampString}</span>{' '}
            fid <span className="text-gray-400">{item.fid}</span>
          </p>
        </li>
      ))}
    </ul>
  </aside>
}

export default AccountsRightSidebar;
