import { Properties } from 'csstype';

export const castTextStyle = {
  'whiteSpace': 'pre-wrap',
  // based on https://css-tricks.com/snippets/css/prevent-long-urls-from-breaking-out-of-container/
  /* These are technically the same, but use both */
  'overflowWrap': 'break-word',
  'wordWrap': 'break-word',

  'MsWordBreak': 'break-all',
  /* This is the dangerous one in WebKit, as it breaks things wherever */
  // 'word-break': 'break-all',
  /* Instead use this non-standard one: */
  'wordBreak': 'break-word',

  /* Adds a hyphen where the word breaks, if supported (No Blink) */
  'MsHyphens': 'auto',
  'MozHyphens': 'auto',
  'WebkitHyphens': 'auto',
  'hyphens': 'auto',
} as Properties<string | number, string & any>;
