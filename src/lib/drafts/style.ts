// How EPCMst articles are written, for the AI that drafts them.
//
// Taken from the owner's documents of 9 Oct 2026: his rules for AI drafts,
// the first real article on the site ("Managing CAPEX Risks in 2026"),
// and his website analysis. Change this file to change every future draft.

/** Facts about EPCMst's own offer. These are the company's claims, so they need no outside source. */
export const BRAND_FACTS = [
  "EPCMst Technical Services is based in Calgary and serves energy, pipeline and industrial infrastructure projects in Western Canada.",
  "It connects capital project owners directly with pre-vetted EPCM, pipeline, procurement and worksite specialists, through C2B and C2C contracts.",
  "It works on fixed-rate contracts, without the markups and long onboarding of traditional staffing agencies.",
  "It offers a zero-risk 100% refund guarantee for unfulfilled short-term tasks.",
  "It focuses on urgent, short-term deployment for specific, high-risk project phases.",
  "Contact email: support@epcmst.com. Each service has its own page at /services/<service>. Consultation requests: /request-consultation.",
];

/** Who the articles are for. */
export const AUDIENCE =
  "Project directors and asset managers in oil and gas, mining and power; procurement and commercial managers working to tight CAPEX budgets and schedules; and independent EPCM consultants looking for flexible contracts.";

/** The owner's rules. Each one is also checked in code or by the approver. */
export const RULES = [
  "Length: 900 to 1,200 words of body text.",
  "Tone: professional and practical. Write for experienced industry readers; explain the why, then the what to do. No hype, no exclamation marks.",
  "Never name a client, project owner, or any real company other than EPCMst.",
  "Never state a price, rate or cost figure for EPCMst's services.",
  "Never include confidential or insider details.",
  "Statistics: only use a percentage, dollar figure or other statistic if it appears in one of the numbered sources below, and link that source right where the number appears, like [15%](https://source.example). If no source supports a number, make the point without one.",
  "Do not invent quotes, people, studies, surveys or events. A pull quote is a short unattributed insight sentence, not a quote from a person.",
  "Regulations (for example Bill C-5): describe them only in general terms unless a source states the detail.",
];

/** The shape of the owner's reference article, which drafts follow. */
export const STRUCTURE = `1. Two short opening paragraphs (no heading above them). The first states the situation the reader faces in the area, and uses the main keyword naturally. The second says what the article will help them do.
2. "## " section on the problem or current landscape, with a numbered list of 3 points. Each point starts with a bold lead-in ending in a colon, for example "1. **Supply chain volatility:** ...".
3. "## " section on the better approach, a short paragraph, then one pull quote as a Markdown blockquote ("> ...").
4. A "### " sub-section with 3 or 4 bullets, each starting with a bold lead-in.
5. Where it fits the topic, one "## " section with a Markdown comparison table (3 or 4 rows, 3 or 4 columns). Do not put any unsourced numbers in the table.
6. "## " section with 3 practical next steps as a numbered list, each starting with a bold lead-in.
7. A closing "### " call to action: one or two sentences on how EPCMst helps, then two bullets: "**Email our team:** [support@epcmst.com](mailto:support@epcmst.com)" and "**Explore capabilities:** [<the service page's name>](<the service page's path>)".`;

/**
 * Articles the owner has already planned (website analysis, 9 Oct 2026).
 * When research is done for one of these keywords, his headline is offered
 * first. Titles are shortened to the hub's 70-character limit; his original
 * wording is kept alongside.
 */
export const PLANNED = [
  {
    title: "How to Scale Short-Term EPCM Staffing Without High Agency Overheads",
    original: "How to Scale Short-Term EPCM Staffing Without High Agency Overheads in Western Canada",
    keyword: "Short-term EPCM staffing Western Canada",
    extra_keywords: ["On-demand pipeline engineering consultants", "Direct hire EPCM experts Calgary"],
    service_area: "specialists",
    content_type: "blog-post",
    region: "western-canada",
    angle: "Why agencies are slow and costly for short, urgent needs, and how direct C2B and C2C matching gets pre-vetted specialists on site in days.",
  },
  {
    title: "Why Execution Beats Capacity: Solving Worksite Management Gaps",
    original: "Why Execution Beats Capacity: Solving Worksite Management Gaps on Energy Projects",
    keyword: "Worksite management services Alberta",
    extra_keywords: ["Industrial project execution consultants", "Onsite contractor management Western Canada"],
    service_area: "worksite-management",
    content_type: "industry-commentary",
    region: "alberta",
    angle: "Why energy projects stall in field execution, why adding headcount doesn't fix it, and how targeted worksite specialists do.",
  },
] as const;

/** Allowances for the AI service, per person per day and for the team per month. */
export const DRAFT_LIMITS = { headlinesPerPersonPerDay: 20, draftsPerPersonPerDay: 10, draftsTeamPerMonth: 300 } as const;
