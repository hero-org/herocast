import React, { useEffect, useRef } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import { classNames } from "@/common/helpers/css";
import { getCasterData } from "@/common/helpers/farcaster";
import { PostType } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";

const Item = ({ entity: { name, char } }) => <div className="bg-gray-100">{`${name}: ${char}`}</div>;
const Loading = ({ data }) => <div>Loading</div>;
const casterData = getCasterData();

const DropdownItem = ({ entity, selected }) => {
  const { username, display_name } = entity;
  return (
    <div className="relative cursor-default select-none py-2 pl-3 pr-9">
      <div className="flex">
        <span className={classNames('truncate text-radix-slate1', selected && 'font-semibold')}>{username}</span>
        <span
          className={classNames(
            'ml-2 truncate',
            selected ? 'text-radix-slate3' : 'text-radix-slate4'
          )}
        >
          {display_name}
        </span>
      </div>
    </div>
  )
}

function findUsername(username: string): CasterType[] {
  return casterData.filter((caster: CasterType) =>
    caster.username?.startsWith(username) || caster.display_name?.startsWith(username)
  );
};

export default function NewPostEntry({ draft, onTextChange, onSubmit }: { draft: PostType, onTextChange: (text: string) => void, onSubmit: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaElement = textareaRef.current;
  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleAccounts = useAccountStore((state) => state.accounts.length > 1);

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

  const characterToTrigger = {
    // ":": {
    //   dataProvider: token => {
    //     return emoji(token)
    //       .slice(0, 5)
    //       .map(({ name, char }) => ({ name, char }));
    //   },
    //   component: Item,
    //   output: (item, trigger) => item.char
    // },
    "@": {
      dataProvider: (token: string) => {
        return findUsername(token.toLowerCase()).slice(0, 7)
      },
      component: DropdownItem,
      output: (item, trigger) => `@${item.username}`
    }
  }

  return (
    <div className="flex items-start space-x-4">
      <div className="min-w-0 flex-1 w-96">
        <div>
          <div className="mt-2">
            <div className="-m-0.5 rounded-sm p-0.5">
              <label htmlFor="comment" className="sr-only">
                Comment
              </label>
              <div ref={textareaRef}>
                <ReactTextareaAutocomplete
                  value={draft.text}
                  onChange={(e) => onTextChange(e.target.value)}
                  containerClassName="relative mt-2"
                  className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
                  loadingComponent={Loading}
                  minChar={1}
                  rows={5}
                  trigger={characterToTrigger}
                  dropdownClassName="absolute z-10 -ml-4 mt-5 max-h-60 w-full overflow-auto rounded-sm bg-radix-slate10 py-1 text-base shadow-sm ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-start">
          <button
            onClick={() => onSubmit()}
            type="submit"
            className="max-h-6inline-flex items-center rounded-sm bg-zinc-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
          >
            Post {hasMultipleAccounts && `as @${account.name}`}
          </button>
        </div>
        <div className="mt-4 border-l-4 border-yellow-400 bg-yellow-500 p-2">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-200" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-200">
                this doesn't support embedding urls yet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// <ReactTextareaAutocomplete
//   ref={textareaRef}
//   rows={5}
//   name="comment"
//   id="comment"
//   className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
//   placeholder="your cast..."
//   value={draft.text}
//   onChange={(e) => onTextChange(e.target.value)}
// />
