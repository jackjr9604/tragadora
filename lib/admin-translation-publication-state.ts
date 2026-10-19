import type {PublicationExclusionReason,PublicationSnapshot} from './admin-translation-publication-policy'
import type {BulkOperationReportItem} from './admin-translation-operation-report'
export type PublicationPreviewItem={stateId:string;resourceType:string;resourceId:string;resourceLabel:string;fieldName:string;sourceLanguage:string;targetLanguage:string;source:string|null;approved:string|null;currentPublic:string|null;protected:boolean;eligible:boolean;exclusionReason:PublicationExclusionReason|null;snapshot:PublicationSnapshot}
export type PublicationPreviewState={ok:boolean;message:string;items:PublicationPreviewItem[]}
export const INITIAL_PUBLICATION_PREVIEW_STATE:PublicationPreviewState={ok:false,message:'',items:[]}
export type PublicationMutationItem=BulkOperationReportItem&{outcome:'published'|'skipped'|'error'}
export type PublicationMutationState={ok:boolean;message:string;selected:number;published:number;skipped:number;conflicts:number;failed:number;items:PublicationMutationItem[]}
export const INITIAL_PUBLICATION_MUTATION_STATE:PublicationMutationState={ok:false,message:'',selected:0,published:0,skipped:0,conflicts:0,failed:0,items:[]}
