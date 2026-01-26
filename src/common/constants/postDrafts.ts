import { DraftStatus, type DraftTemplateType } from './farcaster';

export const NewPostDraft: DraftTemplateType = {
  text: '',
  parentUrl: undefined,
  parentCastId: undefined,
  status: DraftStatus.writing,
  mentionsToFids: {},
};

export const JoinedHerocastPostDraft: DraftTemplateType = {
  text: 'I just joined @herocast! ',
  status: DraftStatus.writing,
  mentionsToFids: { herocast: '18665' },
};

export const NewFeedbackPostDraft: DraftTemplateType = {
  text: 'hey @hellno, feedback on @herocast: ',
  parentUrl: 'https://herocast.xyz',
  status: DraftStatus.writing,
  mentionsToFids: { herocast: '18665', hellno: '13596' },
};
