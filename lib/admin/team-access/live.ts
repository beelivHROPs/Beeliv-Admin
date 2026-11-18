/** Live invitations only. No fixture fallback, automatic write retry or browser-owned grants. */
import { createInvitationAccessLink, listInvitations as listInvitationsWire, getSession, createInvitationDraft, editInvitationDraft, invitationAction, checkInvitationStatus } from "../../auth/service";
import type { InvitationListItem, InvitationDraftInput, ManagedInvitation, ManagementResult } from "../../auth/invitation-management-wire";
import type { AdapterEvent } from "../adapter";
import { RestrictedError } from "../adapter";
import { createIntentKeys, OutcomeUnknownError, orgCall } from "../org-records/transport";
import type { TeamAccessAdapter } from "./adapter";
import type { DeliveryStatus, Invitation, InvitationQuery, InvitationsPage, InvitationStatus, InviteInput, TeamFacets } from "./types";
import type { ClientRowDto, ClientDetailDto, Page } from "../../server/org-records/types";

export class TeamAccessNotConnectedError extends Error {
  constructor() { super("This account-management feature is not available yet."); this.name="TeamAccessNotConnectedError"; }
}
type CreateLink = typeof createInvitationAccessLink;
type ListWire = typeof listInvitationsWire;
type Dependencies = { session: typeof getSession; create: typeof createInvitationDraft; edit: typeof editInvitationDraft; action: typeof invitationAction; status: typeof checkInvitationStatus; org: typeof orgCall };
export const LIST_PAGE_SIZE=100, LIST_PAGE_CAP=10;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const rec=(value:unknown): Record<string,unknown>|null => value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
export const mapInvitationStatus=(s:InvitationListItem["status"]):InvitationStatus=>s==="draft"?"pending":s;
export function mapDeliveryStatus(s:InvitationListItem["deliveryStatus"]):DeliveryStatus {
  return s==="not_sent"?"not-sent":s==="queued"||s==="delayed"?"queued":s==="sent"||s==="delivered"?"sent":s==="copied"?"copied":"failed";
}
const ROLE_LABEL:Record<string,string>={head_of_operations:"Head of Operations",hr_manager:"HR Manager",hr_officer:"HR Officer",talent:"Staff access",client:"Client access"};
const FAILURE_TEXT:Partial<Record<InvitationListItem["deliveryStatus"],string>>={failed:"The email could not be sent.",bounced:"The email address did not accept the message.",complained:"The recipient marked the message as unwanted.",suppressed:"Sending to this address is blocked.",unknown:"Delivery could not be confirmed."};
export function mapInvitation(i:InvitationListItem):Invitation {
  const delivery=mapDeliveryStatus(i.deliveryStatus);
  return {id:i.id,revision:i.revision,sourceStatus:i.status,reference:i.reference??"",kind:i.kind,email:"",name:i.displayName,roleLabel:ROLE_LABEL[i.role]??"",scopeLabel:i.scopeSummary,status:mapInvitationStatus(i.status),delivery:{status:delivery,lastAttemptAt:null,...(delivery==="failed"&&FAILURE_TEXT[i.deliveryStatus]?{failureReason:FAILURE_TEXT[i.deliveryStatus]}:{})},invitedBy:i.inviter,invitedAt:i.invitedAt,expiresAt:i.expiresAt,resendCount:i.resendCount,link:""};
}
const counts=():Record<InvitationStatus|"all",number>=>({all:0,pending:0,accepted:0,expired:0,revoked:0});
const DEFINITE=new Set(["rate_limited","no_access","conflict","review_required","delivery_blocked","validation_failed","invalid_request","unauthenticated","mfa_required","forbidden"]);
const notConnected=():Promise<never>=>Promise.reject(new TeamAccessNotConnectedError());

/** Profile/expiry/roles never come from browser hints. Existing Staff records are required. */
export function invitationDraft(input:InviteInput):InvitationDraftInput {
  if(input.newClient) throw new Error("Create the client and outlets in Clients before inviting a contact.");
  if(!["internal","client","staff"].includes(input.kind)||!Array.isArray(input.outletIds)||!Array.isArray(input.scopeClientIds)||typeof input.allClients!=="boolean")throw new Error("invalid_request");
  const email=input.email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error("invalid_request");
  const role=input.kind==="internal"?input.roleId:input.kind==="client"?"client":"talent";
  if(input.kind==="internal"&&!['hr_officer','hr_manager'].includes(role??""))throw new Error("invalid_request");
  if(input.allClients&&(input.kind!=="internal"||role!=="hr_manager"))throw new Error("invalid_request");
  let scopes:InvitationDraftInput["scopes"]=[];
  if(input.kind==="internal") {
    if(!input.allClients) scopes=input.scopeClientIds.map(clientId=>({clientId,outletId:null}));
  } else {
    if(!input.clientId||!UUID.test(input.clientId)||!input.outletIds.length)throw new Error("Choose an existing client and outlet.");
    scopes=input.outletIds.map(outletId=>({clientId:input.clientId!,outletId}));
  }
  if(scopes.length>100||scopes.some(s=>!UUID.test(s.clientId)||s.outletId!==null&&!UUID.test(s.outletId))||new Set(scopes.map(s=>s.clientId+":"+s.outletId)).size!==scopes.length)throw new Error("invalid_request");
  if(input.kind==="staff"&&(!input.personId||!UUID.test(input.personId)))throw new Error("Choose an existing Staff record.");
  const jobTitle=input.jobTitle?.trim()??"";
  if(jobTitle.length>60||/[\u0000-\u001f]/.test(jobTitle))throw new Error("invalid_request");
  return {kind:input.kind,email,role:role as InvitationDraftInput["role"],personId:input.kind==="staff"?input.personId!:null,scopes:scopes.sort((a,b)=>(a.clientId+":"+a.outletId).localeCompare(b.clientId+":"+b.outletId)),allClients:input.allClients,jobTitle};
}
export function createLiveTeamAccessAdapter(createLink:CreateLink=createInvitationAccessLink,listWire:ListWire=listInvitationsWire,overrides:Partial<Dependencies>={}):TeamAccessAdapter {
  const deps:Dependencies={session:getSession,create:createInvitationDraft,edit:editInvitationDraft,action:invitationAction,status:checkInvitationStatus,org:orgCall,...overrides};
  const listeners=new Set<(event:AdapterEvent)=>void>();
  const known=new Map<string,Invitation>(), specs=new Map<string,InvitationDraftInput>();
  const intents=new Map<string,ReturnType<typeof createIntentKeys>>();
  const progress=new Map<string,ManagedInvitation>(), inFlight=new Map<string,Promise<Invitation>>();
  const notify=()=>listeners.forEach(l=>l("reset"));
  function key(resource:string){let value=intents.get(resource);if(!value){value=createIntentKeys();intents.set(resource,value);}return value;}
  function managed(i:ManagedInvitation):Invitation {
    const previous=known.get(i.id);
    const item:Invitation={id:i.id,revision:i.revision,sourceStatus:i.status,actions:{...i.actions},reference:previous?.reference??"",kind:i.kind,email:i.email,name:previous?.name||i.email,jobTitle:i.jobTitle,roleLabel:ROLE_LABEL[i.role],scopeLabel:previous?.scopeLabel??(i.allClients?"Beeliv-wide":i.scopes.length?"Assigned clients and outlets":"No client assignment"),status:mapInvitationStatus(i.status),delivery:{status:mapDeliveryStatus(i.deliveryStatus),lastAttemptAt:previous?.delivery.lastAttemptAt??null,retryAt:i.retryAt,...(FAILURE_TEXT[i.deliveryStatus]?{failureReason:FAILURE_TEXT[i.deliveryStatus]}:{})},invitedBy:previous?.invitedBy??"",invitedAt:previous?.invitedAt??"",expiresAt:i.expiresAt,resendCount:previous?.resendCount??0,link:""};
    known.set(i.id,item);return item;
  }
  async function mutation(resource:string,payload:Record<string,unknown>,send:(requestId:string)=>Promise<ManagementResult>):Promise<ManagedInvitation> {
    const keys=key(resource),requestId=keys.begin(payload);
    let result:ManagementResult;
    try {result=await send(requestId);}catch {keys.settle(new OutcomeUnknownError(requestId));throw new Error("outcome_unknown");}
    if(!result.ok){if(!DEFINITE.has(result.reason)){keys.settle(new OutcomeUnknownError(requestId));throw new Error("outcome_unknown");}keys.settle(null);throw new Error(result.reason==="rate_limited"?"cooldown":result.reason);}
    keys.settle(null);managed(result.invitation);return result.invitation;
  }
  function revision(id:string,expected?:number){const value=expected??known.get(id)?.revision;if(!UUID.test(id)||!Number.isSafeInteger(value)||Number(value)<1)throw new Error("Not available");return Number(value);}
  async function action(name:Parameters<typeof invitationAction>[0],id:string,expected?:number) {
    const expectedRevision=revision(id,expected);
    const value=await mutation("invitation:"+id,{action:name,id,expectedRevision},requestId=>deps.action(name,{requestId,invitationId:id,expectedRevision}));
    if(name==="invite-replace"&&specs.has(id))specs.set(value.id,specs.get(id)!);
    notify();return managed(value);
  }
  async function access(){
    const value=rec(await deps.session("admin")),a=rec(value?.access),permissions=rec(a?.permissions);
    if(value?.ok!==true||a?.app!=="admin"||a.status!=="active"||!['head_of_operations','hr_manager','hr_officer'].includes(String(a.role))||!permissions||Object.values(permissions).some(v=>typeof v!=="boolean"))throw new RestrictedError();
    return {role:String(a.role),permissions};
  }
  async function getCapabilities(){const a=await access(),p=a.permissions;return {canInviteInternal:p.invite_internal===true&&(p.grant_hr_officer===true||p.grant_hr_manager===true),canInviteClient:p.invite_client===true&&p.grant_client===true,canInviteStaff:p.invite_staff===true&&p.grant_staff===true,canChangeState:false,canChangeAccess:false};}
  async function getFacets():Promise<TeamFacets> {
    const a=await access(),p=a.permissions;
    const roles=[{id:"hr_manager",name:"HR Manager"},{id:"hr_officer",name:"HR Officer"}];
    const result:TeamFacets={roles,invitableRoleIds:roles.filter(r=>p.invite_internal===true&&p["grant_"+r.id]===true).map(r=>r.id),clients:[],outlets:[],accessLevels:[{id:"client",name:"Client access"}],expiryOptions:[],clientTypes:[],staffRoles:[]};
    try {
      let page=1,calls=0,seen=0,total:number|null=null;
      const seenClients=new Set<string>(),seenOutlets=new Set<string>();
      while(calls<20){
        calls++;const list=await deps.org<Page<ClientRowDto>>("client-list",{page,pageSize:50});
        if(!Number.isSafeInteger(list.total)||list.total<0||total!==null&&total!==list.total||!Array.isArray(list.items)||list.page!==page)throw new Error();
        total=list.total;
        for(const row of list.items){
          if(!UUID.test(row.id)||seenClients.has(row.id))throw new Error();seenClients.add(row.id);seen++;
          if(row.status==="inactive")continue;
          result.clients.push({id:row.id,name:row.name});
          let after:string|null=null;const cursors=new Set<string>();let got=0,expected:number|null=null;
          for(;;){
            if(++calls>20)throw new Error();
            const detail:ClientDetailDto=await deps.org<ClientDetailDto>("client-get",{clientId:row.id,outletsLimit:200,...(after?{outletsAfter:after}:{})});
            if(detail.id!==row.id||!Number.isSafeInteger(detail.outletsTotal)||detail.outletsTotal<0||expected!==null&&expected!==detail.outletsTotal||!Array.isArray(detail.outlets))throw new Error();
            expected=detail.outletsTotal;
            for(const outlet of detail.outlets){if(!UUID.test(outlet.id)||outlet.clientId!==row.id||seenOutlets.has(outlet.id))throw new Error();seenOutlets.add(outlet.id);got++;if(outlet.status!=="inactive")result.outlets.push({id:outlet.id,clientId:row.id,name:outlet.name});}
            if(!detail.outletsTruncated){if(got!==expected||detail.outletsNextCursor!==null)throw new Error();break;}
            if(!detail.outlets.length||!detail.outletsNextCursor||cursors.has(detail.outletsNextCursor))throw new Error();const nextCursor:string=detail.outletsNextCursor;after=nextCursor;cursors.add(nextCursor);
          }
        }
        if(seen===total)return result;
        if(!list.items.length||seen>total)throw new Error();page++;
      }
      throw new Error();
    } catch {return {...result,clients:[],outlets:[],scopeOptionsUnavailable:true};}
  }
  return {
    subscribe(listener){listeners.add(listener);return()=>void listeners.delete(listener);},getCapabilities,getFacets,
    getMatrix:notConnected,listInternal:notConnected,listClientUsers:notConnected,listAccounts:notConnected,
    async getInvitation(id,expected){const expectedRevision=revision(id,expected);const result=await deps.status(id);if(!result.ok)throw new Error(result.reason==="rate_limited"?"rate_limited":"unavailable");if(result.invitation.id!==id||result.invitation.revision!==expectedRevision)throw new Error("conflict");return managed(result.invitation);},
    findDuplicates:notConnected,setState:notConnected,updateAccess:notConnected,getHistory:notConnected,
    async invite(input){
      const spec=invitationDraft(input),signature=JSON.stringify(spec);
      const ongoing=inFlight.get(signature);if(ongoing)return ongoing;
      const task=(async()=>{
        let draft=progress.get(signature);
        if(!draft){draft=await mutation("create",spec,requestId=>deps.create({...spec,requestId}));progress.set(signature,draft);specs.set(draft.id,spec);}
        if(!draft.reviewed){draft=await mutation("invitation:"+draft.id,{action:"invite-review",id:draft.id,expectedRevision:draft.revision},requestId=>deps.action("invite-review",{requestId,invitationId:draft!.id,expectedRevision:draft!.revision}));progress.set(signature,draft);}
        progress.delete(signature);notify();return managed(draft);
      })();
      inFlight.set(signature,task);try{return await task;}finally{inFlight.delete(signature);}
    },
    sendInvitation:(id,expected)=>action("invite-send",id,expected),resendInvitation:(id,expected)=>action("invite-resend",id,expected),
    revokeInvitation:(id,_reason,expected)=>action("invite-revoke",id,expected),
    async replaceInvitation(id,expected){const replaced=await action("invite-replace",id,expected);return action("invite-review",replaced.id,replaced.revision);},
    async updateInvitationEmail(id,email,expected){
      const expectedRevision=revision(id,expected);
      // Editing sends a complete draft: use current server role/scopes, never an old browser snapshot.
      const status=await deps.status(id);
      if(!status.ok)throw new Error("unavailable");
      if(status.invitation.id!==id||status.invitation.revision!==expectedRevision)throw new Error("conflict");
      const current=status.invitation;
      if(current.kind==="staff")throw new Error("Correct Staff contact details in Staff Directory before issuing a new invitation.");
      const spec:InvitationDraftInput={kind:current.kind,email:current.email,role:current.role,personId:null,scopes:current.scopes,allClients:current.allClients,jobTitle:current.jobTitle};
      const next={...spec,email:email.trim().toLowerCase()};
      const edited=await mutation("invitation:"+id,{action:"invite-edit-draft",id,expectedRevision,spec:next},requestId=>deps.edit({...next,requestId,invitationId:id,expectedRevision}));
      specs.set(id,next);return action("invite-review",edited.id,edited.revision);
    },
    async listInvitations(q:InvitationQuery):Promise<InvitationsPage>{
      const seen=new Map<string,Invitation>();let after:{createdAt:string;id:string}|null=null;
      for(let page=0;page<LIST_PAGE_CAP;page++){
        let result:Awaited<ReturnType<ListWire>>;
        try{result=await listWire({limit:LIST_PAGE_SIZE,...(after?{after}:{})});}catch{throw new Error("unavailable");}
        if(!result.ok)throw new Error(result.reason==="rate_limited"?"rate_limited":"unavailable");
        for(const item of result.items){const mapped=mapInvitation(item),prior=known.get(item.id);if(prior?.revision===item.revision&&prior.actions)mapped.actions={...prior.actions};seen.set(item.id,mapped);known.set(item.id,mapped);}
        if(result.next&&after&&result.next.id===after.id&&result.next.createdAt===after.createdAt)throw new Error("unavailable");
        after=result.next;if(!after)break;
      }
      if(after)throw new Error("unavailable"); // A capped partial page is never a complete list/count.
      const all=[...seen.values()];if(!all.length)return {rows:[],total:0,statusCounts:counts(),workspaceEmpty:true};
      const needle=q.search.trim().toLowerCase(),base=all.filter(i=>(!q.kind||i.kind===q.kind)&&(!needle||[i.name,i.reference,i.roleLabel,i.scopeLabel].some(t=>t.toLowerCase().includes(needle))));
      const statusCounts=counts();for(const i of base){statusCounts.all++;statusCounts[i.status]++;}const rows=base.filter(i=>!q.status||i.status===q.status);
      return {rows,total:rows.length,statusCounts,workspaceEmpty:false};
    },
    async createAccessLink(id,expected){
      const expectedRevision=revision(id,expected),keys=key("invitation:"+id),requestId=keys.begin({action:"invite-copy-link",id,expectedRevision});
      let result:Awaited<ReturnType<CreateLink>>;
      try{result=await createLink({requestId,invitationId:id,expectedRevision});}catch{keys.settle(new OutcomeUnknownError(requestId));throw new Error("outcome_unknown");}
      if(!result.ok){if(!DEFINITE.has(result.reason)){keys.settle(new OutcomeUnknownError(requestId));throw new Error("outcome_unknown");}keys.settle(null);throw new Error(result.reason==="rate_limited"?"cooldown":"Not available");}
      keys.settle(null);managed(result.invitation);notify();if(!result.accessLink)throw new Error("outcome_unknown");
      return {url:result.accessLink.url,expiresAt:result.accessLink.expiresAt};
    },
  };
}
