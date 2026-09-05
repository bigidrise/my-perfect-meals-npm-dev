# U5 Authorization Ledger

**Scope and method.** This is the canonical, de-duplicated U5-A route ledger
(reviewed 2026-09-04).  A record is keyed by the *effective mounted* method and
path, not by a router-local path.  `GET,POST` in the Method column is a compact
notation for two records with the same remaining nineteen fields; it does **not**
mean an HTTP method wildcard.  The count table expands those method lists.
Duplicate `/api/meal-logs` registrations and overlapping professional-board,
physician-report, adherence, and body-composition findings have been collapsed.

## Field key and classification

Each compact record has all 20 required fields, in this order:

`M` method; `R` route; `C` category; `A` auth; `Actor`; `Sel` selector;
`Client` accepted client identity; `Resolve` server resolution; `Org` organization
membership/tenant check; `Rel` active relationship; `Role`; `Ent` entitlement;
`Consent`; `Own` ownership; `Rev` revocation; `Exp` expiration; `Audit`;
`Pos` positive test; `Neg` negative authorization test; `Class`.

`—` means no evidence in the decisive handler, not that a control is necessarily
unnecessary. “No route test” is not itself a defect: it produces **PARTIAL**
only where the authorization evidence is incomplete. `S` means session/auth
identity; `AR` active relationship; `BO` business owner; `BA` business
admin/pro; `WS` workspace resolver; `RB` `requireBoardAccess`; `CW`
`requireClientWorkspaceAccess`; `WW` `requireWorkspaceAccess`.

## Active canonical ledger

|M|R|C|A|Actor|Sel|Client|Resolve|Org|Rel|Role|Ent|Consent|Own|Rev|Exp|Audit|Pos|Neg|Class|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|POST|/api/business/pilot-authorizations|pilot create|S+admin|S|org/champion body|admin|approved-pilot service|approved org|—|admin|admin|—|admin action|status|token duration|console|pilot tests|admin middleware|VERIFIED ISOLATED|
|GET|/api/business/pilot-authorizations/claim/:token|pilot preview|public|token|token|bearer token|token service|approved org|—|—|—|—|token|claimed/status|token expiry|errors|pilot tests|invalid/expired|PARTIAL|
|POST|/api/business/pilot-authorizations/claim|pilot claim|S|S+token|token/id|S+token|claim service/champion match|business|claim state|champion|pilot|acceptance|claimed champion|status|token expiry|errors|pilot tests|mismatch/expired|VERIFIED ISOLATED|
|GET,PATCH|/api/business/pilot-setup|pilot setup|S|S|body name|S|claimed-champion service|business|claimed|champion|pilot|implicit claim|service-bound|status|—|errors|pilot tests|unclaimed|VERIFIED ISOLATED|
|GET|/api/business/workspaces|workspace discovery|S|S|—|S|caller membership helper|direct/active memberships|active member|—|—|—|helper-bound|membership status|—|errors|no route test|no route test|PARTIAL|
|POST|/api/business/pilots/:pilotId/invitations|pilot invite|S+BA|S|pilotId,email,role|S|authorized business + pilot|business-bound|admin/owner|BA|Pro/org|recipient accept|business/pilot|cancel|invite expiry|email/log|pilot tests|cross-business/role|VERIFIED ISOLATED|
|DELETE,POST|/api/business/pilot-invitations/:inviteId[/resend]|pilot invite revoke/resend|S+BA|S|inviteId|S|invite.businessId match|business-bound|admin/owner|BA|Pro/org|prior acceptance|business invite|cancel/reset|expiry/reset|email/log|pilot tests|cross-business|VERIFIED ISOLATED|
|GET|/api/business/mine|business dashboard|S+BA|S|—|S|authorized business|business|admin/owner|BA|Pro/org|—|business|status|invite expiry|console|seat tests|unauthorized|VERIFIED ISOLATED|
|GET|/api/business/membership|membership|S+Pro|S|—|S|userId+active membership|business|active|Pro|effective access|—|self membership|removed status|—|—|seat tests|nonmember|VERIFIED ISOLATED|
|POST|/api/business/invite|business invite|S+BA|S|email,role,type|S|authorized business|business|admin/owner|BA|Pro/org|later accept|business|cancel|7 days|email|invite tests|role/seat|VERIFIED ISOLATED|
|PATCH,DELETE|/api/business/members/:memberId[/restore]|member lifecycle|S+BA|S|memberId|S|memberId+businessId|business|active/restored|BA|Pro/org|—|business member|removed/active|timestamps|console|write tests|cross-business/role|VERIFIED ISOLATED|
|POST|/api/business/removal-notice/dismiss|membership notice|S|S|—|S|own removed membership|business|removed|member|—|user action|own row|dismissed|—|—|no route test|auth middleware|VERIFIED ISOLATED|
|DELETE,POST|/api/business/invitations/:token[/resend]|business invite lifecycle|S+BA|S|token|S|token+business+pending|business|admin/owner|BA|Pro/org|later accept|business invite|cancel/reset|expiry/reset|email|invite tests|cross-business|VERIFIED ISOLATED|
|PATCH|/api/business/policy|business policy|S+BA|S|policy body|S|authorized business update/history|business|admin/owner|BA|Pro/org|—|business|mutable|—|policy history|write tests|non-admin|VERIFIED ISOLATED|
|PATCH|/api/business/org-policies|organization flags|S+BA|S|flags|S|authorized organization|linked org|admin/owner|BA|Pro/org|—|org|mutable|—|console|no route test|non-admin|VERIFIED ISOLATED|
|GET|/api/business/invite/:token|invite disclosure|public|token|token|bearer token|status/expiry token lookup|business lookup|—|—|—|—|token|status|expiry|errors|invite tests|invalid/expired|POLICY DECISION REQUIRED|
|POST|/api/business/invite/:token/accept|invite acceptance|S|S+token|token|S/email|email,seat,atomic accept checks|business|pending invite|invite role|seat/trial|explicit accept|business invite|accepted|expiry|console|rejoin/invite tests|email/full/expired|VERIFIED ISOLATED|
|PATCH|/api/business/name|business admin|S+BA|S|name|S|authorized business|business|admin/owner|BA|Pro/org|—|business|—|—|—|write tests|non-admin|VERIFIED ISOLATED|
|POST|/api/business/seats|seat/billing admin|S+BO|S|seats|S|owner + subscription|business|owner|BO|Pro/Stripe|billing action|business|subscription|Stripe|console|seat tests|nonowner/full|VERIFIED ISOLATED|
|GET|/api/business/check-status|business status|S|S|—|S|owner/active-admin query|business|active admin|owner/admin|—|—|business|status|—|—|no route test|nonowner|VERIFIED ISOLATED|
|POST|/api/business/create-org|organization create|S|S|name|S|owner idempotency transaction|new business|owner|owner|prebilling|owner action|owner|pending billing|—|logs|write tests|duplicate/race|VERIFIED ISOLATED|
|GET|/api/business/policy-history|policy audit read|S|S|—|S|owner business + history|business|owner|BO|—|—|business|—|—|history rows|no route test|nonowner|VERIFIED ISOLATED|
|GET|/api/business/members/:memberId/clients|member client counts|S|S|memberId|S|BO + memberId/businessId/active|business|active|BO|MFA mount|—|business member|status|—|—|no route test|compound selector|PARTIAL|
|POST|/api/stripe/checkout/business|business checkout|S|S|body|S|reserved business owner predicate|business|owner|BO|Stripe|payment|business|webhook|Stripe|Stripe logs|billing tests|owner predicate|VERIFIED ISOLATED|
|GET|/api/procare-invite/token/:token|ProCare invite preview|public|token|token|bearer token|masked token service|provider|pending|—|—|—|token|accepted|expiry|—|invite tests|invalid/expired|VERIFIED ISOLATED|
|POST|/api/procare-invite/token/:token/accept|ProCare invite accept|S|S+token|token|S/email|email,tier,legal,relationship service|provider|active invite|provider/client|ProCare|legal acceptance|invited recipient|accepted|expiry|service|invite tests|email/expired/replay|VERIFIED ISOLATED|
|POST|/api/admin/users/:userId/pilot-procare/grant|pilot admin|S+admin|S|userId|admin|admin service target|platform|—|admin|pilot|admin action|admin target|revoke endpoint|pilot dates|console|no route test|admin middleware|VERIFIED ISOLATED|
|POST|/api/admin/users/:userId/pilot-procare/revoke|pilot revoke|S+admin|S|userId|admin|admin service target|platform|—|admin|—|admin action|admin target|explicit revoke|dates|console|no route test|admin middleware|VERIFIED ISOLATED|
|POST|/api/admin/users/:userId/pilot-procare/clients|pilot assignment|S+admin|S|userId/body|admin|admin service target|platform|—|admin|pilot|admin action|admin target|revoke|dates|console|no route test|admin middleware|VERIFIED ISOLATED|
|DELETE|/api/admin/users/:userId/pilot-procare/clients/:invitationId|pilot assignment revoke|S+admin|S|userId,invitationId|admin|admin service target|platform|—|admin|—|admin action|admin target|explicit revoke|dates|console|no route test|admin middleware|VERIFIED ISOLATED|
|GET,POST|/api/diabetes/profile|diabetes profile|S+diabetic builder|S|self|S|authUser.id|—|—|builder|assigned builder|—|self|—|—|write audit|no route test|no route test|PARTIAL|
|GET,POST|/api/diabetes/glucose|glucose log|S+diabetic builder|S|self; relatedMealId body|S|authUser.id; meal ref unverified|—|—|builder|assigned builder|—|self log|—|—|write audit|no route test|no route test|PARTIAL|
|GET|/api/glucose-logs/api/users/:userId/glucose-logs|glucose history|S|S|userId|self only|userId===authUser.id|—|self|self|S|—|self|—|—|—|no route test|equality|VERIFIED ISOLATED|
|GET|/api/glucose-logs/api/users/:userId/glucose-logs/latest|latest glucose|S|S|userId|self only|userId===authUser.id|—|self|self|S|—|self|—|—|—|no route test|equality|VERIFIED ISOLATED|
|POST|/api/glucose-logs/api/users/:userId/glucose-logs|glucose write|S|S|userId|self only|userId===authUser.id|—|self|self|S|—|self|—|—|write audit|no route test|equality|VERIFIED ISOLATED|
|GET,POST,PATCH,DELETE|/api/users/:userId/glp1-shots[/:shotId]|GLP-1 medication|S+glp1 flag|S|userId,shotId|self only|equality + userId/shotId predicate|flag only|self|self|flag|—|self|—|—|write audit|no route test|equality/scope|VERIFIED ISOLATED|
|GET,PUT|/api/glp1/profile|GLP-1 profile|S+builder|S|self|S|auth user SQL|—|—|builder|glp1 builder|—|self|—|—|partial audit|no route test|no route test|PARTIAL|
|GET,POST|/api/glp1/daily-tolerance|GLP-1 tolerance|S+builder|S|self|S|auth user service|—|—|builder|glp1 builder|—|self|—|dated record|audit table|no route test|no route test|PARTIAL|
|GET,POST|/api/glp1/hub-checkin[/today]|GLP-1 check-in|S+builder|S|self|S|auth user service|—|—|builder|glp1 builder|—|self|—|—|audit table|no route test|no route test|PARTIAL|
|GET,POST|/api/performance/carb-cycle[/log\|/override]|clinical nutrition|S+clinical|S|self|S|auth user|—|—|self|clinical tier|—|self|—|state dates|—|no route test|no route test|PARTIAL|
|GET|/api/nutrition-summary|nutrition summary|S|S|self|S|authUser.id queries|—|—|self|S|—|self|—|hydration only|—|no route test|no route test|PARTIAL|
|GET,POST,PATCH,DELETE|/api/pregnancy/{bootstrap,conversation,ask,setup}|pregnancy clinical state|S+clinical (shared); S (prod)|S|self|S|auth-user rows|—|—|self|billing clinical|—|self|setup delete|—|—|no route test|no route test|POLICY DECISION REQUIRED|
|GET,POST,PATCH|/api/performance/{setup,context,ask,schedule,today,mode}|performance clinical state|S+clinical|S|self|S|auth-user rows|—|—|self|billing clinical|—|self|—|—|nonuniform audit|no route test|no route test|PARTIAL|
|GET,POST|/api/therapeutic/{context,setup}|therapeutic state|S+strict clinical|S|self|S|auth user|—|—|self|billing clinical|—|self|—|—|—|no route test|no route test|PARTIAL|
|POST|/api/meals/:mealInstanceId/log|meal history|S|S|mealInstanceId|S/token|id+userId update|—|—|self|S|—|composite owner|auth invalidation|token/session|timestamps|no route test|no route test|VERIFIED ISOLATED|
|POST|/api/meals/:mealInstanceId/skip|meal history|S|S|mealInstanceId|S/token|id+userId update|—|—|self|S|—|composite owner|auth invalidation|token/session|timestamps|no route test|no route test|VERIFIED ISOLATED|
|POST|/api/meals/:mealInstanceId/replace-and-optional-log|meal replace|S|S|mealInstanceId,recipeId|S/token|meal owner; recipe ownership absent|—|—|self|S|—|meal only|auth invalidation|token/session|timestamps|no route test|no route test|PARTIAL|
|GET|/api/meals/instances/:date|meal history|S|S|date|S/token|userId+date|—|—|self|S|—|self|auth invalidation|token/session|—|no route test|no route test|VERIFIED ISOLATED|
|POST|/api/meals/create-and-log|meal history|S|S|body date/slot|S/token|insert auth user|—|—|self|S|—|self|auth invalidation|token/session|timestamps|no route test|no route test|VERIFIED ISOLATED|
|GET,POST|/api/meal-logs|meal logs|S|S|query/body userId|self only|reject mismatch; auth-user SQL|—|—|self|S|—|self|auth invalidation|token/session|—|no route test|mismatch check|VERIFIED ISOLATED|
|POST|/api/meal-log|legacy nutrition write|S|S|body userId|self only|reject mismatch; persist auth actor|—|self|self|S|—|self|session/token|—|console|U5 route test|cross-user|VERIFIED ISOLATED|
|POST|/api/meal-log/glp1|legacy nutrition write|S|S|body userId|self only|reject mismatch; persist auth actor|—|self|self|S|—|self|session/token|—|console|U5 route test|cross-user|VERIFIED ISOLATED|
|POST|/api/diary/log|food diary write|S|S|body user_id|self only|reject mismatch; auth actor|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|GET|/api/diary/totals|food diary read|S|S|query user_id|self only|reject mismatch; auth actor|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|DELETE|/api/diary/:entry_id|food diary delete|S|S|entry_id|self only|entry+auth-user predicate|—|self|self|S|—|composite owner|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|GET|/api/diary/:user_id/:date_local|food diary read|S|S|user_id,date|self only|reject mismatch; auth actor/date|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|GET|/api/adherence/:userId|adherence|S|S|userId|self only|reject mismatch; auth actor|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|POST|/api/macros/log|macro history|S|S|body no user|S/token|server userId|—|—|self|S|—|self|auth invalidation|token/session|row|source test|no route test|VERIFIED ISOLATED|
|POST|/api/users/:userId/macros/quick|macro history|S|S|userId ignored|S/token|insert auth user|—|—|self|S|—|self|auth invalidation|token/session|row|no route test|ignored selector|VERIFIED ISOLATED|
|GET|/api/users/:userId/macro-logs/{summary,daily-with-source}|delegated macros|S|S|userId|self/pro|self or active careTeam/clientLink|—|AR|pro/self|Pro access|—|target scoped|relationship status|token/session|—|no route test|relationship check|VERIFIED ISOLATED|
|POST|/api/boards/:boardId/items|personal board write|S+Essential|S|boardId|owner|board owner before insert|—|self|self|Essential|—|board owner|—|—|—|board auth test|cross-user/no-write|VERIFIED ISOLATED|
|DELETE|/api/boards/:boardId/items/:itemId|personal board delete|S+Essential|S|boardId,itemId|S|board.owner + item.boardId|—|self|self|Essential|—|owner/containment|—|—|—|board delete test|cross-board|VERIFIED ISOLATED|
|POST|/api/boards/:boardId/items/:itemId/log|board log|S+Essential|S|boardId,itemId|S|owner + containment|—|self|self|Essential|—|owner/containment|—|—|activity|handler evidence|no route test|VERIFIED ISOLATED|
|POST|/api/boards/:boardId/repeat-day|personal board write|S+Essential|S|boardId|owner|board owner before item access|—|self|self|Essential|—|board owner|—|—|—|board auth test|cross-user/no-write|VERIFIED ISOLATED|
|POST|/api/boards/:boardId/commit|personal board commit|S+Essential|S|boardId|owner|board owner before item access|—|self|self|Essential|—|board owner|—|—|owner audit|board auth test|cross-user/no-write|VERIFIED ISOLATED|
|GET|/api/users/:userId/boards/:program/current|personal board read/create|S+Essential|S|userId/program|self only|path userId equals auth actor before DB|—|self|self|Essential|implicit|self|—|—|creation activity|board auth test|cross-user/no-query|VERIFIED ISOLATED|
|GET,POST,DELETE|/api/pro/board/clients/:clientId/boards/:program/current; /:boardId/items[/:itemId]|professional board|S+MFA+ProCare+RB|S|clientId,boardId,itemId|relation-bound|RB + client/board/item scope|no explicit assertion|AR|permission|phase gates|relation-derived|scoped client|active status|—|activity except delete|no route test|no route test|PARTIAL|
|POST|/api/pro/board/clients/:clientId/boards/:boardId/repeat-day|professional board|S+MFA+ProCare+RB|S|clientId,boardId|relation-bound|RB+canEditPlan+board scope|no explicit assertion|AR|permission|phase gates|relation-derived|scoped client|active status|—|—|no route test|no route test|PARTIAL|
|GET,PATCH|/api/pro/board/clients/:clientId/board-access|board relationship control|S|S|clientId|active pair only|careTeam client/pro/active|no explicit assertion|AR|relation role|—|implicit|pair|status|—|activity on patch|no route test|pair predicate|PARTIAL|
|GET|/api/pro/week-boards/:clientId/current-week|weekly board read|S+MFA+ProCare+RB|S|clientId|relation-bound|resolved client get/upsert|no explicit assertion|AR|no read permission|phase gates|—|resolved client|status|—|—|no test|no test|PARTIAL|
|GET,PUT|/api/pro/week-board/:clientId/:weekStartISO|weekly board|S+MFA+ProCare+RB|S|clientId,week|relation-bound|resolved client|no explicit assertion|AR|write ignores canEditPlan|phase gates|—|resolved client|status|—|write activity|no test|no permission test|POLICY DECISION REQUIRED|
|GET,PUT|/api/pro/weekly-board/:clientId|weekly board|S+MFA+ProCare+RB|S|clientId,week|relation-bound|resolved client|no explicit assertion|AR|write ignores canEditPlan|phase gates|—|resolved client|status|—|write activity|no test|no permission test|POLICY DECISION REQUIRED|
|GET,POST,DELETE|/api/pro/clients/:clientId/boards/:program/current; /:boardId/items[/:itemId]|professional-board alias|S+MFA+ProCare+RB|S|clientId,boardId,itemId|relation-bound|same proBoard handler|no explicit assertion|AR|permission|phase gates|relation-derived|scoped client|active status|—|activity where write|no route test|no route test|PARTIAL|
|POST|/api/pro/clients/:clientId/boards/:boardId/repeat-day|professional-board alias|S+MFA+ProCare+RB|S|clientId,boardId|relation-bound|same scoped handler|no explicit assertion|AR|canEditPlan|phase gates|relation-derived|scoped client|active status|—|—|no route test|no route test|PARTIAL|
|GET,PATCH|/api/pro/clients/:clientId/board-access|board-control alias|S|S|clientId|active pair only|careTeam pair/active|no explicit assertion|AR|relation role|—|implicit|pair|status|—|activity on patch|no route test|pair predicate|PARTIAL|
|POST,DELETE,GET|/api/pro/tablet/:clientId/{video-message,video/:messageId,video/:messageId/transcript,video/:messageId/playback,video/:messageId/progress,message,note,entry/:entryId,voice-message,voice-note}|pro workspace media|S+MFA+ProCare+WW|S|clientId,messageId,entryId|workspace-bound|WW same-org+active link/member|same-org|AR|professional|phase gates|workspace permission|workspace scoped|active flags|media token where applicable|activity/video audit|studio tests|WW/service scope|VERIFIED ISOLATED|
|GET|/api/pro/tablet/:clientId|pro workspace timeline|S+MFA+ProCare+WW|S|clientId|workspace-bound|WW same-org+active link/member|same-org|AR|professional|phase gates|workspace permission|workspace scoped|active flags|—|activity helpers|no test|WW|VERIFIED ISOLATED|
|GET|/api/pro/tablet/unread-summary|pro aggregate messages|S+MFA+ProCare|S|—|studio actor|getProStudioId; studio-wide rows|studio only|not per-client active|professional|phase gates|—|studio|relationship revocation unclear|cache TTL|—|no test|no per-client test|POLICY DECISION REQUIRED|
|GET|/api/pro/tablet/all-messages|pro aggregate messages|S+MFA+ProCare|S|—|studio actor|getProStudioId; studio-wide rows|studio only|not per-client active|professional|phase gates|—|studio|relationship revocation unclear|—|—|no test|no per-client test|POLICY DECISION REQUIRED|
|GET|/api/pro/tablet/audio/:entryId|pro voice playback|S+MFA+ProCare|S|entryId|studio actor|studioId+entry SQL|studio only|not active pair|professional|phase gates|—|studio|revocation unclear|no query expiry|—|no test|no relationship test|POLICY DECISION REQUIRED|
|POST|/api/client/tablet/message|client message|S|S|—|actor only|resolveStudioId + actor insert|no explicit assertion|helper-dependent|client|—|implicit|actor row|helper-dependent|—|activity|401 inline|no tenant test|PARTIAL|
|POST,GET|/api/client/tablet/{video-message,video/:messageId/playback,video/:messageId/progress}|client video media|S+CW|S|messageId|workspace-bound|CW scoped studio/client|same-org|AR|client|—|workspace|actor/record scope|active flags|media expiry/replay|video audit|studio video tests|wrong recipient/token|VERIFIED ISOLATED|
|GET|/api/client/tablet/|client timeline|S+CW|S|—|actor|CW + actor SQL|same-org|AR|client|—|visibility|self|active flags|—|list audit|studio tests|CW|VERIFIED ISOLATED|
|POST,DELETE,GET|/api/client/tablet/{voice-message,entry/:entryId,video/:messageId,video/:messageId/transcript,audio/:entryId}|client voice/media|S+CW|S|entryId,messageId|workspace-bound|CW/service scoped|same-org|AR|client|—|workspace|service scope|active flags|token expiry|activity/service audit|studio tests|wrong scope/token|VERIFIED ISOLATED|
|GET,POST|/api/care-team/; /api/care-team/invite|care relationship/list/invite|S (invite MFA)|S|email/role|S|own rows/invite owner|—|pending/active|client/provider|Pro route gate|connect later|own/inviter|no invite revoke|7 days|console|no route test|no route test|PARTIAL|
|POST|/api/care-team/connect|care relationship connect|S|S+code|code|S/email|email,expiry,tier,legal service|—|active relationship|provider/client|tier|legal|activation service|accepted state unclear|expiry|console|no route test|replay unclear|PARTIAL|
|POST|/api/care-team/:id/approve|care approval|S|S|member id|own member only|id+userId predicate|—|relationship|client|Pro route gate|approval|member owner|revoke endpoint|—|—|no route test|compound predicate|VERIFIED ISOLATED|
|POST|/api/care-team/:id/revoke|care revoke|S|S|member id|own member only|id+userId predicate|—|relationship|client|Pro route gate|revocation|member owner|explicit revoked|—|console|no route test|compound predicate|VERIFIED ISOLATED|
|POST|/api/physician-reports/|physician report create|S+MFA+premium mount|S|userId|self/delegated|self or active same-org physician-client|same-org|AR|physician/self|premium|—|target scoped|relationship status|—|—|physician auth tests|cross-user/org/role|VERIFIED ISOLATED|
|GET|/api/physician-reports/view/:accessCode|shared report view|S+MFA+premium mount|code|accessCode|bearer code|storage access-code lookup|—|policy unclear|—|premium|share token|code|active/expiry unclear|report expiry|view tracking|no test|no test|PARTIAL|
|GET|/api/physician-reports/user/:userId|physician reports|S+MFA+premium mount|S|userId|self/delegated|self or active same-org physician-client|same-org|AR|physician/self|premium|—|target scoped|relationship status|—|—|physician auth tests|cross-user/org/role|VERIFIED ISOLATED|
|DELETE|/api/physician-reports/:id|report revoke|S+MFA+premium mount|S|id|owner only|report owner check + persistent deactivation|—|self|self|premium|—|report owner|persistent revoke|—|—|physician auth tests|cross-user|VERIFIED ISOLATED|
|POST|/api/coaching/notify-coach|coach notification|S|S|body|S|handler-specific|studio unclear|unclear|coach|config identity|—|unclear|unclear|—|—|no test|no test|POLICY DECISION REQUIRED|
|POST|/api/coaching/activate-client/:clientId|coach activation|S+registered coach|S|clientId|coach config|clientId+coach studio|studio|membership|coach|config|—|studio member|status active|—|console|no test|cross-studio predicate|PARTIAL|
|GET|/api/coaching/queue/new-clients|coach queue|S+registered coach|S|—|coach config|fixed studio query|studio|statuses unfiltered|coach|config|—|studio|status unclear|—|—|no test|no test|PARTIAL|
|POST|/api/coaching/send-invite|coach invite|S+registered coach|S|email|coach config|authenticated studio insert|studio|pending|coach|config|later accept|studio invite|accepted|30 days|console|no test|no test|PARTIAL|
|GET|/api/coaching/pending-invites|coach invites|S+registered coach|S|—|coach config|fixed studio, pending/unexpired|studio|pending|coach|config|—|studio|accepted|30 days|—|no test|no test|PARTIAL|
|GET|/api/coaching/invite/:token|coach invite preview|public|token|token|bearer token|pending/unexpired lookup|—|pending|—|—|—|token|accepted|30 days|—|no test|no test|PARTIAL|
|POST|/api/uploads/request-url|upload signing|S|S|metadata|any S user|random private path without owner ACL|—|—|user|—|—|unresolved|—|presigned expiry|—|identity test|migration required|POLICY DECISION REQUIRED|
|GET|/objects/:objectPath(*)|object download|none|none|objectPath|arbitrary|legacy private key lacks owner ACL|—|—|—|—|—|unresolved|none|storage only|—|route-exists test|migration required|POLICY DECISION REQUIRED|
|POST,GET|/api/meal-images/recover[/:recoveryId]|meal image recovery|S|S|savedMeal/media/recoveryId|S|service query includes userId|—|self|user|—|—|service scoped|job lifecycle|job lifecycle|—|no test|service wrong-user|VERIFIED ISOLATED|
|GET,POST,PUT,DELETE|/api/users/:userId/body-composition[/.../:entryId]|body composition|S|S|userId,entryId|self only|actor equality + owner predicates|—|self|self|S|—|self/entry owner|—|—|—|body auth tests|cross-user/no-write|VERIFIED ISOLATED|
|POST|/api/api/wmc2/:userId/regenerate|nutrition regeneration|S+rate limit|S|userId|self only|path equals auth actor|—|self|self|cost guard|—|self|session/token|—|telemetry|U5 route test|cross-user|VERIFIED ISOLATED|
|GET|/api/reminders/:userId|concierge reminders|S|S|userId|self only|path equals auth actor|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|GET|/api/voice-prompts/:userId|concierge voice prompts|S|S|userId|self only|path equals auth actor|—|self|self|S|—|self|session/token|—|—|U5 route test|cross-user|VERIFIED ISOLATED|
|GET,PUT|/api/users/:userId/preferences|user preferences|S|S|userId|self only|reject unless userId===authUser.id|—|self|self|S|—|self|auth invalidation|token/session|—|no route test|equality|VERIFIED ISOLATED|
|GET,PATCH|/api/users/:userId/app-preferences|app preferences|S|S|userId|self only|reject unless userId===authUser.id|—|self|self|S|—|self|auth invalidation|token/session|—|no route test|equality|VERIFIED ISOLATED|
|GET|/api/users/:userId/alcohol-logs|alcohol/health log|S|S|userId ignored|S/token|handler resolves auth actor, not selector|—|self|self|S|—|self|auth invalidation|token/session|—|no route test|ignored selector|VERIFIED ISOLATED|
|GET|/api/cooking-classes/progress/:userId/:track|learning progress|S+active access|S|userId,track|self only|userId===authUser.id|—|self|self|active access|—|self|access revocation|session|—|no route test|equality|VERIFIED ISOLATED|
|GET|/api/cooking-challenges/user/:userId/badges|challenge badges|S+active access|S|userId|self only|userId===authUser.id|—|self|self|active access|—|self|access revocation|session|—|no route test|equality|VERIFIED ISOLATED|
|GET|/api/biometrics/labs/:userId|clinical labs|S+clinical-labs|S|userId|authorized target|verifyClinicalAccess then target SQL|clinical policy|verified clinical relation|clinical|labs access|implied verifier|target policy|relationship revocation|policy|cross-user read audit|no route test|verifier|VERIFIED ISOLATED|
|GET,POST,PATCH,DELETE|/api/partner/admin/*/:userId|partner administration|S+admin|S|userId|admin only|admin target-record handlers|platform admin|n/a|admin|admin|n/a|admin authority|admin action|—|route audit helpers|no route test|admin middleware|VERIFIED ISOLATED|

## U5-B production-order and omitted-route reconciliation

The original inventory's 181-record total is retained as its audited baseline.
Production-order review added **70 distinct effective method/path records** that
were absent from that baseline. Duplicate registrations of the same method/path
are one canonical record but are separately asserted by registration-order tests.

|Effective route family|Expanded records|Class|
|---|---:|---|
|`POST /api/meal-logs-enhanced`; `GET /api/meal-logs/:userId`|2|VERIFIED ISOLATED|
|Body-composition goal plus Pro client GET/POST|3|VERIFIED ISOLATED|
|Production-direct `POST /api/wmc2/:userId/regenerate`|1|VERIFIED ISOLATED|
|Legacy meal-plan GET-by-user and PATCH-by-ID|2|VERIFIED ISOLATED|
|User reminder create/list/delete/update|4|VERIFIED ISOLATED|
|User meal-preference GET/PUT|2|VERIFIED ISOLATED|
|User profile and subscription GET|2|VERIFIED ISOLATED|
|Weekly, Step 5, enforced, and testosterone generators|4|VERIFIED ISOLATED|
|Physician thyroid and hormone protocol writes|2|VERIFIED ISOLATED|
|Raw `POST /api/users` creator|1|LEGACY / UNREACHABLE (410 retired)|
|Reminder scheduler debug GET|1|VERIFIED ISOLATED|
|Kids veggie-progress GET|1|VERIFIED ISOLATED|
|Recipe save and add-to-week POST|2|VERIFIED ISOLATED|
|Phone state, request-code, verify, and SMS-consent|4|VERIFIED ISOLATED|
|Meal-plan archive list/read/create/delete/repeat|5|VERIFIED ISOLATED|
|Founder consent GET/POST and testimonial POST|3|VERIFIED ISOLATED|
|Glycemic settings GET/POST/PUT|3|VERIFIED ISOLATED|
|Meal-plan current/all/read/save/delete/activate/shopping-list under both mounts|14|VERIFIED ISOLATED|
|Alcohol create/history/delete|3|VERIFIED ISOLATED|
|Time-preset list/save/delete/default|4|VERIFIED ISOLATED|
|Onboarding progress/step/reset/claim operations|5|VERIFIED ISOLATED|
|Public-object GET and companion-image serve GET|2|POLICY DECISION REQUIRED|
|**Added records**|**70**|**67 verified; 2 policy; 1 legacy**|

## Totals (expanded method/path records)

|Domain|Verified isolated|Partial|Confirmed defect|Policy decision required|Legacy / unreachable|Total|
|---|---:|---:|---:|---:|---:|---:|
|All U5 domains after reconciliation|171|56|0|19|5|251|
|**Canonical total**|**171**|**56**|**0**|**19**|**5**|**251**|

Arithmetic from the audited baseline: 25 prior defect records moved to verified;
private object download moved from defect to policy; private upload issuance
moved from partial to policy; the personal current-board selector moved from
policy to verified; and the 70 added records contribute 67 verified, two policy,
and one legacy. No effective method/path is counted twice.

## Confirmed defects and policy questions

**Confirmed defects:** zero remain after U5 repair and production-order review.
The focused attacker matrix and independent final review found no remaining
concrete P0/P1 authorization defect in the active reviewed route families.

**Policy questions (preserved):** whether public business invite disclosure may
return invitee email and organization metadata; production pregnancy’s missing
clinical gate; professional board helper tenant isolation and weekly-write
permission semantics; post-revocation visibility in professional aggregate/tablet
audio routes; and the ownership/public-capability policy for private objects,
configured public objects, and companion images. These keep overall U5 at
**PARTIAL**, despite closure of all confirmed P0/P1 defects.

## LEGACY / UNREACHABLE (not included as active findings)

|Method|Route|Reason|Decisive reference|
|---|---|---|---|
|POST|/api/business/dev-seed|Returns 404 in production (`NODE_ENV` gate).|`server/routes/businessRoutes.ts:1679-1717`|
|DELETE|/api/business/dev-seed|Development-only companion route; no production capability.|`server/routes/businessRoutes.ts` dev-seed handlers|
|POST|/api/uploads/sign|Deprecated handler returns 501; no operational upload authorization path.|`server/replit_integrations/object_storage/routes.ts`|
|GET,POST|/api/meal-logs (legacy registrations)|Shadowed by authenticated `mealLogsRouter`, mounted earlier in `server/index.ts:431`; active handler is `server/routes/mealLogs.ts`.|`server/index.ts:422-453,1803`; `server/routes.ts:3501-3549,7619-7653`|
|GET|/api/adherence/:userId (later duplicate)|Later shared registration is shadowed, but the earlier active `adherenceRouter` is the defect recorded above.|`server/index.ts:453`; `server/routes.ts:10052`|
|POST|/api/users|Legacy raw account creator now returns 410; account creation remains in the established auth flow.|`server/routes.ts`|

## Decisive source map

Mount composition: `server/routes.ts:9342-9439,9988-10068`,
`server/index.ts:413,422-504,684,1803`, and
`server/prod.ts:935-968,1064-1141,1311`.  Core route evidence:
`businessRoutes.ts:60-1750`; `organizationalPilotAuthorizationService.ts:430-500`;
`procareInviteRoutes.ts:18-125`; `procareInviteService.ts:196-272`;
`diabetes.ts:17-120`; `glucose-logs.ts:21-91`; `glp1Shots.ts:35-130`;
`glp1.ts:13-288`; `pregnancyCoach.ts:152-689`;
`performanceNutrition.ts:38-915`; `therapeuticSetup.ts:63-100`;
`meals.ts:87-254`; `mealLogs.ts:14-60`; `manualMacros.ts:147-173,334-361,662-721`;
`mealBoards.ts:21-368`; `proBoardRoutes.ts:15-424`;
`proWeekBoard.ts:178-368`; `requireBoardAccess.ts:77-152`;
`requireWorkspaceAccess.ts:59-123`; `proTabletRoutes.ts:220-1207`;
`clientTabletRoutes.ts:76-947`; `careTeamRoutes.ts:24-495`;
`physicianReports.ts:10-121`; `bodyComposition.ts:13-219`;
`wmc2Enhanced.ts:32-37`; `concierge.ts:220-236`; and
`object_storage/routes.ts:39-78`.