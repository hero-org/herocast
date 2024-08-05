import { State, createTokenClass } from 'linkifyjs';

const MentionToken = createTokenClass('mention', {
  isLink: true,
  toHref() {
    return '/' + this.toString().slice(1);
  }
});

export default function mentionPlugin({ scanner, parser }) {
  const { DOT, HYPHEN, SLASH, UNDERSCORE, AT } = scanner.tokens;
  const { domain } = scanner.tokens.groups;

  // @
  const At = parser.start.tt(AT); // @

  // Begin with hyphen (not mention unless contains other characters)
  const AtHyphen = At.tt(HYPHEN);
  AtHyphen.tt(HYPHEN, AtHyphen);

  // Valid mention (not made up entirely of symbols)
  const Mention = At.tt(UNDERSCORE, MentionToken);

  At.ta(domain, Mention);
  AtHyphen.tt(UNDERSCORE, Mention);
  AtHyphen.ta(domain, Mention);

  // More valid mentions
  Mention.ta(domain, Mention);
  Mention.tt(HYPHEN, Mention);
  Mention.tt(UNDERSCORE, Mention);

  // Mention with a divider
  const MentionDivider = Mention.tt(SLASH);

  // Once we get a word token, mentions can start up again
  MentionDivider.ta(domain, Mention);
  MentionDivider.tt(UNDERSCORE, Mention);
  MentionDivider.tt(HYPHEN, Mention);

  // ADDED: . transitions
  const MentionDot = Mention.tt(DOT);
  MentionDot.ta(domain, Mention);
  MentionDot.tt(HYPHEN, Mention);
  MentionDot.tt(UNDERSCORE, Mention);

}
export function cashtagPlugin({ scanner, parser }) {
  const { DOLLAR, UNDERSCORE } = scanner.tokens;
  const { alpha, numeric, alphanumeric, emoji } = scanner.tokens.groups;

  // Take or create a transition from start to the '$' sign (non-accepting)
  // Take transition from '$' to any text token to yield valid hashtag state
  // Account for leading underscore (non-accepting unless followed by alpha)
  const Hash = parser.start.tt(DOLLAR);
  const HashPrefix = Hash.tt(UNDERSCORE);
  const Hashtag = new State(CashtagToken);

  Hash.ta(numeric, HashPrefix);
  Hash.ta(alpha, Hashtag);
  Hash.ta(emoji, Hashtag);
  HashPrefix.ta(alpha, Hashtag);
  HashPrefix.ta(emoji, Hashtag);
  HashPrefix.ta(numeric, HashPrefix);
  HashPrefix.tt(UNDERSCORE, HashPrefix);
  Hashtag.ta(alphanumeric, Hashtag);
  Hashtag.ta(emoji, Hashtag);
  Hashtag.tt(UNDERSCORE, Hashtag); // Trailing underscore is okay
}

export const CashtagToken = createTokenClass('cashtag', { isLink: true });

export function channelPlugin({ scanner, parser }) {
  const { SLASH, UNDERSCORE, WS } = scanner.tokens;
  const { alpha, numeric, alphanumeric, emoji } = scanner.tokens.groups;

  // Initial state transitions for beginning of the text
  const InitialSlash = parser.start.tt(SLASH);
  const InitialHashPrefix = InitialSlash.tt(UNDERSCORE);
  const Channel = new State(ChannelToken);

  // Define transitions for channels starting at the beginning of the text
  InitialSlash.ta(numeric, InitialHashPrefix);
  InitialSlash.ta(alpha, Channel);
  InitialSlash.ta(emoji, Channel);
  InitialHashPrefix.ta(alpha, Channel);
  InitialHashPrefix.ta(emoji, Channel);
  InitialHashPrefix.ta(numeric, InitialHashPrefix);
  InitialHashPrefix.tt(UNDERSCORE, InitialHashPrefix);

  // Transitions for channels preceded by whitespace
  const BeforeSlash = parser.start.tt(WS).tt(SLASH);
  const HashPrefix = BeforeSlash.tt(UNDERSCORE);

  // Define transitions
  BeforeSlash.ta(numeric, HashPrefix);
  BeforeSlash.ta(alpha, Channel);
  BeforeSlash.ta(emoji, Channel);
  HashPrefix.ta(alpha, Channel);
  HashPrefix.ta(emoji, Channel);
  HashPrefix.ta(numeric, HashPrefix);
  HashPrefix.tt(UNDERSCORE, HashPrefix);
  Channel.ta(alphanumeric, Channel);
  Channel.ta(emoji, Channel);
}

export const ChannelToken = createTokenClass('channel', { isLink: true });
