import { DraftType, DraftStatus } from './farcaster';

export const NewPostDraft: DraftType = {
  text: '',
  parentUrl: undefined,
  parentCastId: undefined,
  status: DraftStatus.writing,
  mentionsToFids: {},
};

export const PayCasterBotPayDraft: DraftType = {
  text: '@paybot 20 usdc',
  status: DraftStatus.writing,
  mentionsToFids: { paybot: '364927' },
};

export const PayCasterBotRequestDraft: DraftType = {
  text: '@paybot request 20 usdc',
  status: DraftStatus.writing,
  mentionsToFids: { paybot: '364927' },
};

export const RemindMeBotDraft: DraftType = {
  text: '@remindme 1 day',
  status: DraftStatus.writing,
  mentionsToFids: { remindme: '2684' },
};

export const BountyCasterBotDraft: DraftType = {
  text: `Description (be specific on details and any criteria for completing e.g. favorite answer wins, apply to work on this, X number of claims available)
  Amount (USDC, ETH, OP, Warps, degen, higher, or SOL)
  Deadline (optional, defaults to 2 weeks)
  @bountybot posted via @herocast`,
  status: DraftStatus.writing,
  mentionsToFids: { bountybot: '20596', herocast: '18665' },
};

export const LaunchCasterScoutDraft: DraftType = {
  text: `@launch via @herocast
   `,
  status: DraftStatus.writing,
  mentionsToFids: { launch: '2864', herocast: '18665' },
};

export const JoinedHerocastViaHatsProtocolDraft: DraftType = {
  text: 'I just joined @herocast via @hatsprotocol',
  status: DraftStatus.writing,
  mentionsToFids: { herocast: '18665', hatsprotocol: '18484' },
};

export const JoinedHerocastPostDraft: DraftType = {
  text: 'I just joined @herocast! ',
  status: DraftStatus.writing,
  mentionsToFids: { herocast: '18665' },
};

export const NewFeedbackPostDraft: DraftType = {
  text: 'hey @hellno, feedback on @herocast: ',
  parentUrl: 'https://herocast.xyz',
  status: DraftStatus.writing,
  mentionsToFids: { herocast: '18665', hellno: '13596' },
};
