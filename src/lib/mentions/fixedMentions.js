import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';

// Fixed mentions function for production

export function createFixedMentionsSuggestionConfig({ getResults, RenderList }) {
  return {
    suggestion: {
      items: async ({ query }) => {
        const data = await getResults(query);
        if (!data?.length) return [null];
        return data;
      },
      render: () => {
        let reactRenderer;
        let popup;
        return {
          onStart(props) {
            reactRenderer = new ReactRenderer(RenderList, { props, editor: props.editor });
            if (!props.clientRect) return;
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: reactRenderer.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });
          },
          onUpdate(props) {
            reactRenderer?.updateProps?.(props);
            if (!props.clientRect) return;

            // Fix for production
            if (popup) {
              if (Array.isArray(popup) && popup.length > 0) {
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              } else if (typeof popup.setProps === 'function') {
                popup.setProps({ getReferenceClientRect: props.clientRect });
              }
            }
          },
          onKeyDown(props) {
            if (props.event.key === 'Escape') {
              if (popup) {
                if (Array.isArray(popup) && popup.length > 0) popup[0]?.hide();
                else if (typeof popup.hide === 'function') popup.hide();
              }
              return true;
            }

            if (reactRenderer?.ref) {
              if (['ArrowUp', 'ArrowDown', 'Enter'].includes(props.event.key)) {
                return reactRenderer.ref?.onKeyDown?.(props) || false;
              }
            }
            return false;
          },
          onExit() {
            if (popup) {
              if (Array.isArray(popup)) popup[0]?.destroy();
              else if (typeof popup.destroy === 'function') popup.destroy();
            }
            reactRenderer?.destroy?.();
          },
        };
      },
    },
  };
}
