import React, { useEffect, useRef } from "react";
import { Tab } from '@headlessui/react';



export default function NewPostEntry({ draft, onTextChange, onSubmit }: { draft: any, onTextChange: (text: string) => void, onSubmit: () => void }) {

  const renderTextBoxActions = () => {
    return null;
    // return <div className="ml-auto flex items-center space-x-2">
    //   <div className="flex items-center">
    //     <button
    //       type="button"
    //       className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-200 hover:text-gray-300"
    //     >
    //       <span className="sr-only">Insert link</span>
    //       <LinkIcon className="h-5 w-5" aria-hidden="true" />
    //     </button>
    //   </div>
    //   {/* <div className="flex items-center">
    //     <button
    //       type="button"
    //       className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-gray-300"
    //     >
    //       <span className="sr-only">Insert code</span>
    //       <CodeBracketIcon className="h-5 w-5" aria-hidden="true" />
    //     </button>
    //   </div> */}
    //   <div className="flex items-center">
    //     <button
    //       type="button"
    //       className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-200 hover:text-gray-300"
    //     >
    //       <span className="sr-only">Mention someone</span>
    //       <AtSymbolIcon className="h-5 w-5" aria-hidden="true" />
    //     </button>
    //   </div>
    // </div>
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaElement = textareaRef.current;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        onSubmit();
      }
    };
    if (textareaElement) {
      textareaElement.addEventListener("keydown", listener);
    }
    return () => {
      if (textareaElement) {
        textareaElement.removeEventListener("keydown", listener);
      }
    };
  }, [textareaElement, onSubmit]);

  return (
    <div className="flex items-start space-x-4">
      {/* <div className="flex-shrink-0">
        <img
          className="inline-block h-10 w-10 rounded-full"
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
          alt=""
        />
      </div> */}
      <div className="min-w-0 flex-1 w-96">
        <div>
          <Tab.Group>
            {({ selectedIndex }) => (
              <>
                <Tab.List className="flex items-center">
                  {/* <Tab
                    className={({ selected }) =>
                      classNames(
                        selected
                          ? 'bg-gray-500 text-gray-100 hover:bg-gray-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-200',
                        'rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium'
                      )
                    }
                  >
                    Write
                  </Tab> */}
                  {/* <Tab
                    className={({ selected }) =>
                      classNames(
                        selected
                          ? 'bg-gray-500 text-gray-100 hover:bg-gray-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-200',
                        'ml-1 rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium'
                      )
                    }
                  >
                    Preview
                  </Tab> */}
                  {selectedIndex === 0 ? renderTextBoxActions() : null}
                </Tab.List>
                <Tab.Panels className="mt-2">
                  <Tab.Panel className="-m-0.5 rounded-sm p-0.5">
                    <label htmlFor="comment" className="sr-only">
                      Comment
                    </label>
                    <div>
                      <textarea
                        ref={textareaRef}
                        rows={5}
                        name="comment"
                        id="comment"
                        className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
                        placeholder="your cast..."
                        value={draft.text}
                        onChange={(e) => onTextChange(e.target.value)}
                      />
                    </div>
                  </Tab.Panel>
                  {/* <Tab.Panel className="-m-0.5 rounded-sm p-0.5">
                    <div className="border-b">
                      <div className="mx-px mt-px px-3 pb-24 pt-2 text-sm leading-5 bg-gray-600 text-gray-200">
                        {draft.text}
                      </div>
                    </div>
                  </Tab.Panel> */}
                </Tab.Panels>
              </>
            )}
          </Tab.Group>
          <div className="mt-2 flex justify-end">
            {/* <span className="mt-2 text-gray-400">posting to {selectedChannel ? `${selectedChannel.name} channel` : 'your mainfeed'}</span> */}
            <button
              onClick={() => onSubmit()}
              type="submit"
              className="inline-flex items-center rounded-sm bg-zinc-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
