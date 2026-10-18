import type { ReviewExclusionReason } from './admin-translation-review-policy'

export type ReviewPreviewItem = { stateId:string;resourceType:string;resourceId:string;resourceLabel:string;fieldName:string;sourceLanguage:string;targetLanguage:string;source:string|null;draft:string|null;protected:boolean;eligible:boolean;exclusionReason:ReviewExclusionReason|null }
export type ReviewPreviewState = { ok:boolean;message:string;items:ReviewPreviewItem[] }
export const INITIAL_REVIEW_PREVIEW_STATE:ReviewPreviewState={ok:false,message:'',items:[]}
