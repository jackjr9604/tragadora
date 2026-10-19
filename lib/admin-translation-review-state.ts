import type { ReviewExclusionReason, ReviewSnapshot } from './admin-translation-review-policy'
import type { BulkOperationReportItem } from './admin-translation-operation-report'

export type ReviewPreviewItem = { stateId:string;resourceType:string;resourceId:string;resourceLabel:string;fieldName:string;sourceLanguage:string;targetLanguage:string;source:string|null;draft:string|null;protected:boolean;eligible:boolean;exclusionReason:ReviewExclusionReason|null;snapshot:ReviewSnapshot }
export type ReviewPreviewState = { ok:boolean;message:string;items:ReviewPreviewItem[] }
export const INITIAL_REVIEW_PREVIEW_STATE:ReviewPreviewState={ok:false,message:'',items:[]}

export type ReviewMutationItem = BulkOperationReportItem & { outcome:'approved'|'rejected'|'skipped'|'error' }
export type ReviewMutationState = { ok:boolean;message:string;selected:number;processed:number;approved:number;rejected:number;skipped:number;conflicts:number;failed:number;items:ReviewMutationItem[] }
export const INITIAL_REVIEW_MUTATION_STATE:ReviewMutationState={ok:false,message:'',selected:0,processed:0,approved:0,rejected:0,skipped:0,conflicts:0,failed:0,items:[]}
