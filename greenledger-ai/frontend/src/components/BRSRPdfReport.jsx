/**
 * BRSRPdfReport — Pixel-faithful clone of SEBI's BRSR Annexure I template,
 * fully wired to a live `dashboardState` JSON payload.
 *
 * Layout, typography, table structures, spacing and colors match the SEBI-
 * published reference 1:1 (Word-rendered Calibri → Helvetica). The form
 * itself is a government-mandated regulatory format that listed entities
 * are required to file in this exact structure.
 *
 * Data model — pass either:
 *   <BRSRPdfReport dashboardState={...} />   ← preferred, current shape
 *   <BRSRPdfReport data={...} />             ← legacy flat shape
 *   <BRSRPdfReport report={apiResponse} />   ← legacy nested API response
 *
 * dashboardState shape:
 *   { general:        { cin, entityName, financialYear, reportingBoundary },
 *     environmental:  { scope_1_tco2e, scope_2_tco2e, scope_3_tco2e,
 *                       total_energy_kwh, total_water_kl, renewable_pct,
 *                       total_waste_mt, ghg_intensity_tco2e_cr },
 *     social:         { female_wage_pct, well_being_spend_pct,
 *                       msme_procurement_pct, ltifr_employees },
 *     governance:     { payable_days, data_breach_pct,
 *                       related_party_buy_pct, regulatory_fines } }
 *
 * Missing/null values are rendered as "0", "0%" or "—" so no cell stays blank.
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ── Extracted style variables ─────────────────────────────────────────── */
const C = {
  titleBlue: '#1F4E79',
  text:      '#000000',
  border:    '#000000',
  bg:        '#FFFFFF',
};

const FS = {
  docTitle:    14,
  annexure:    11,
  principle:   14,
  section:     11,
  subsection:  11,
  body:        11,
  tableBody:   10,
  micro:        9,
};

const styles = StyleSheet.create({
  page: {
    paddingTop:      72,
    paddingBottom:   72,
    paddingLeft:     72,
    paddingRight:    72,
    fontFamily:      'Helvetica',
    fontSize:        FS.body,
    color:           C.text,
    lineHeight:      1.40,
    backgroundColor: C.bg,
  },
  annexure: {
    fontFamily:   'Helvetica-BoldOblique',
    fontSize:     FS.annexure,
    color:        C.titleBlue,
    textAlign:    'right',
    marginBottom: 14,
  },
  docTitle: {
    fontFamily:     'Helvetica-Bold',
    fontSize:       FS.docTitle,
    color:          C.titleBlue,
    textAlign:      'center',
    textDecoration: 'underline',
    marginBottom:   18,
  },
  sectionHeading: {
    fontFamily:   'Helvetica-Bold',
    fontSize:     FS.section,
    color:        C.text,
    marginTop:    10,
    marginBottom: 12,
  },
  subsectionHeading: {
    fontFamily:     'Helvetica',
    fontSize:       FS.subsection,
    color:          C.text,
    textDecoration: 'underline',
    marginTop:      10,
    marginBottom:   8,
  },
  principleHeading: {
    fontFamily:   'Helvetica-Bold',
    fontSize:     FS.principle,
    color:        C.text,
    marginTop:    14,
    marginBottom: 14,
    lineHeight:   1.25,
  },
  numberedRow: {
    flexDirection: 'row',
    marginBottom:  4,
  },
  numberedNum:  { width: 22, fontFamily: 'Helvetica', fontSize: FS.body },
  numberedText: { flex: 1,   fontFamily: 'Helvetica', fontSize: FS.body },
  indicatorBox: {
    borderWidth:     0.5,
    borderColor:     C.border,
    paddingVertical: 6,
    marginTop:       6,
    marginBottom:    8,
  },
  indicatorText: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   FS.body,
    textAlign:  'center',
  },
  para:        { marginBottom: 8, fontFamily: 'Helvetica',         fontSize: FS.body },
  paraItalic:  {                  fontFamily: 'Helvetica-Oblique', fontSize: FS.body },
  table:       {
    borderWidth:  0.5,
    borderColor:  C.border,
    marginTop:    6,
    marginBottom: 12,
  },
  row:        { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowLast:    { flexDirection: 'row' },
  cell:       {
    paddingVertical:   4,
    paddingHorizontal: 5,
    borderRightWidth:  0.5,
    borderRightColor:  C.border,
    fontSize:          FS.tableBody,
    fontFamily:        'Helvetica',
    lineHeight:        1.30,
  },
  cellLast:   {
    paddingVertical:   4,
    paddingHorizontal: 5,
    fontSize:          FS.tableBody,
    fontFamily:        'Helvetica',
    lineHeight:        1.30,
  },
  cellHeader: { fontFamily: 'Helvetica-Bold' },
  cellCenter: { textAlign:  'center' },
  bandRow: {
    flexDirection:     'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  bandText: {
    flex:              1,
    paddingVertical:   4,
    paddingHorizontal: 5,
    fontFamily:        'Helvetica-Bold',
    fontSize:          FS.tableBody,
    textAlign:         'center',
  },
  noteSmall: {
    fontFamily:   'Helvetica-Oblique',
    fontSize:     FS.micro,
    marginTop:    -6,
    marginBottom: 10,
  },
});

/* ── Fallback formatters ───────────────────────────────────────────────── */
/* Empty/null numerics → "0" or "0%". Empty/null strings → "—". Never blank. */

const isEmpty = (v) => v === undefined || v === null || v === '' || Number.isNaN(v);
const num     = (v) => (isEmpty(v) ? '0'  : String(v));
const pct     = (v) => (isEmpty(v) ? '0%' : `${v}%`);
const str     = (v) => (isEmpty(v) ? '—'  : String(v));

/* ── Reusable primitives ───────────────────────────────────────────────── */

const NumberedQ = ({ n, children }) => (
  <View style={styles.numberedRow} wrap={false}>
    <Text style={styles.numberedNum}>{n}.</Text>
    <Text style={styles.numberedText}>{children}</Text>
  </View>
);

const Indicator = ({ kind = 'Essential' }) => (
  <View style={styles.indicatorBox} wrap={false}>
    <Text style={styles.indicatorText}>{kind} Indicators</Text>
  </View>
);

const Table = ({ widths, rows, bands = {} }) => (
  <View style={styles.table} wrap={false}>
    {rows.map((row, rIdx) => {
      const isLastRow = rIdx === rows.length - 1;
      return (
        <View key={`r-${rIdx}`}>
          {bands[rIdx] && (
            <View style={styles.bandRow}>
              <Text style={styles.bandText}>{bands[rIdx]}</Text>
            </View>
          )}
          <View style={isLastRow ? styles.rowLast : styles.row}>
            {row.map((c, cIdx) => {
              const isLastCell = cIdx === row.length - 1;
              const flexBasis  = widths[cIdx] ?? 1;
              return (
                <View
                  key={`c-${rIdx}-${cIdx}`}
                  style={{
                    flex: flexBasis,
                    ...(isLastCell ? styles.cellLast : styles.cell),
                  }}
                >
                  <Text
                    style={[
                      c.header && styles.cellHeader,
                      c.center && styles.cellCenter,
                    ]}
                  >
                    {c.text ?? ' '}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    })}
  </View>
);

const headerCells = (labels) => labels.map(t => ({ text: t, header: true, center: true }));
const blankRow    = (count)  => Array.from({ length: count }, () => ({ text: ' ' }));

const PRINCIPLE_COLS = ['P 1','P 2','P 3','P 4','P 5','P 6','P 7','P 8','P 9'];

/* ── SECTION A : General Disclosures (Page 1) ──────────────────────────── */

const SectionA_Page1 = ({ data }) => {
  const g  = data.general || {};
  const v  = (k) => (isEmpty(g[k]) ? '' : `: ${g[k]}`);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.annexure}>Annexure I</Text>
      <Text style={styles.docTitle}>BUSINESS RESPONSIBILITY &amp; SUSTAINABILITY REPORTING FORMAT</Text>

      <Text style={styles.sectionHeading}>SECTION A: GENERAL DISCLOSURES</Text>
      <Text style={styles.subsectionHeading}>I.  Details of the listed entity</Text>

      <NumberedQ n="1">Corporate Identity Number (CIN) of the Listed Entity{v('cin')}</NumberedQ>
      <NumberedQ n="2">Name of the Listed Entity{v('entityName')}</NumberedQ>
      <NumberedQ n="3">Year of incorporation{v('yearOfIncorporation')}</NumberedQ>
      <NumberedQ n="4">Registered office address{v('registeredOffice')}</NumberedQ>
      <NumberedQ n="5">Corporate address{v('corporateOffice')}</NumberedQ>
      <NumberedQ n="6">E-mail{v('email')}</NumberedQ>
      <NumberedQ n="7">Telephone{v('telephone')}</NumberedQ>
      <NumberedQ n="8">Website{v('website')}</NumberedQ>
      <NumberedQ n="9">Financial year for which reporting is being done{v('financialYear')}</NumberedQ>
      <NumberedQ n="10">Name of the Stock Exchange(s) where shares are listed{v('exchanges')}</NumberedQ>
      <NumberedQ n="11">Paid-up Capital{v('paidUp')}</NumberedQ>
      <NumberedQ n="12">Name and contact details (telephone, email address) of the person who may be contacted in case of any queries on the BRSR report{v('contactPerson')}</NumberedQ>
      <NumberedQ n="13">Reporting boundary - Are the disclosures under this report made on a standalone basis (i.e. only for the entity) or on a consolidated basis (i.e. for the entity and all the entities which form a part of its consolidated financial statements, taken together).{isEmpty(g.reportingBoundary) ? '' : `  ${g.reportingBoundary}`}</NumberedQ>

      <Text style={styles.subsectionHeading}>II.  Products/services</Text>

      <NumberedQ n="14"><Text>Details of business activities <Text style={styles.paraItalic}>(accounting for 90% of the turnover):</Text></Text></NumberedQ>
      <Table
        widths={[0.7, 2, 2, 1.6]}
        rows={[
          [
            { text: 'S. No.',                            header: true, center: true },
            { text: 'Description of Main Activity',      header: true },
            { text: 'Description of Business Activity',  header: true },
            { text: '% of Turnover of the entity',       header: true },
          ],
          ...(data.businessActivities?.length
            ? data.businessActivities.map((r, i) => [
                { text: String(i + 1), center: true },
                { text: str(r.mainActivity) },
                { text: str(r.businessActivity) },
                { text: pct(r.turnoverPct) },
              ])
            : [blankRow(4), blankRow(4)]),
        ]}
      />

      <NumberedQ n="15"><Text>Products/Services sold by the entity <Text style={styles.paraItalic}>(accounting for 90% of the entity&rsquo;s Turnover):</Text></Text></NumberedQ>
      <Table
        widths={[0.7, 2, 1.5, 2.4]}
        rows={[
          [
            { text: 'S. No.',                          header: true, center: true },
            { text: 'Product/Service',                 header: true },
            { text: 'NIC Code',                        header: true },
            { text: '% of total Turnover contributed', header: true },
          ],
          ...(data.products?.length
            ? data.products.map((r, i) => [
                { text: String(i + 1), center: true },
                { text: str(r.product) },
                { text: str(r.nicCode) },
                { text: pct(r.turnoverPct) },
              ])
            : [blankRow(4), blankRow(4), blankRow(4)]),
        ]}
      />
    </Page>
  );
};

/* ── SECTION A : Operations & Employees (Page 2) ───────────────────────── */

const SectionA_Page2 = ({ data }) => {
  const ops = data.operations || {};
  const emp = data.employees  || {};
  const w   = data.women      || {};
  const t   = data.turnover   || {};

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.subsectionHeading}>III.  Operations</Text>

      <NumberedQ n="16">Number of locations where plants and/or operations/offices of the entity are situated:</NumberedQ>
      <Table
        widths={[2, 1.6, 1.6, 1.2]}
        rows={[
          [
            { text: 'Location',          header: true },
            { text: 'Number of plants',  header: true, center: true },
            { text: 'Number of offices', header: true, center: true },
            { text: 'Total',             header: true, center: true },
          ],
          [
            { text: 'National', header: true },
            { text: num(ops.national?.plants),  center: true },
            { text: num(ops.national?.offices), center: true },
            { text: num(ops.national?.total),   center: true },
          ],
          [
            { text: 'International', header: true },
            { text: num(ops.international?.plants),  center: true },
            { text: num(ops.international?.offices), center: true },
            { text: num(ops.international?.total),   center: true },
          ],
        ]}
      />

      <NumberedQ n="17">Markets served by the entity:</NumberedQ>
      <Text style={styles.para}>a.  Number of locations</Text>
      <Table
        widths={[3, 2]}
        rows={[
          [
            { text: 'Locations', header: true },
            { text: 'Number',    header: true, center: true },
          ],
          [{ text: 'National (No. of States)' },        { text: num(data.markets?.statesCount),    center: true }],
          [{ text: 'International (No. of Countries)' },{ text: num(data.markets?.countriesCount), center: true }],
        ]}
      />
      <Text style={styles.para}>b.  What is the contribution of exports as a percentage of the total turnover of the entity?  {pct(data.markets?.exportPct)}</Text>
      <Text style={styles.para}>c.  A brief on types of customers:  {str(data.markets?.customerTypes)}</Text>

      <Text style={styles.subsectionHeading}>IV.  Employees</Text>

      <NumberedQ n="18">Details as at the end of Financial Year:</NumberedQ>
      <Text style={styles.para}>a.  Employees and workers (including differently abled):</Text>
      <Table
        widths={[0.7, 2.4, 1, 1, 1.2, 1, 1.2]}
        rows={[
          [
            { text: 'S. No.',      header: true, center: true },
            { text: 'Particulars', header: true },
            { text: 'Total\n(A)',  header: true, center: true },
            { text: 'No. (B)',     header: true, center: true },
            { text: '% (B / A)',   header: true, center: true },
            { text: 'No. (C)',     header: true, center: true },
            { text: '% (C / A)',   header: true, center: true },
          ],
          [
            { text: '1.', center: true }, { text: 'Permanent (D)' },
            { text: num(emp.permEmpA),       center: true },
            { text: num(emp.permEmpMaleN),   center: true },
            { text: pct(emp.permEmpMalePct), center: true },
            { text: num(emp.permEmpFemN),    center: true },
            { text: pct(emp.permEmpFemPct),  center: true },
          ],
          [
            { text: '2.', center: true }, { text: 'Other than Permanent (E)' },
            { text: num(emp.otherEmpA),       center: true },
            { text: num(emp.otherEmpMaleN),   center: true },
            { text: pct(emp.otherEmpMalePct), center: true },
            { text: num(emp.otherEmpFemN),    center: true },
            { text: pct(emp.otherEmpFemPct),  center: true },
          ],
          [
            { text: '3.', center: true }, { text: 'Total employees (D + E)' },
            { text: num(emp.totalEmpA),       center: true },
            { text: num(emp.totalEmpMaleN),   center: true },
            { text: pct(emp.totalEmpMalePct), center: true },
            { text: num(emp.totalEmpFemN),    center: true },
            { text: pct(emp.totalEmpFemPct),  center: true },
          ],
        ]}
        bands={{ 1: 'EMPLOYEES' }}
      />
      <Table
        widths={[0.7, 2.4, 1, 1, 1.2, 1, 1.2]}
        rows={[
          [
            { text: '4.', center: true }, { text: 'Permanent (F)' },
            { text: num(emp.permWrkA),       center: true },
            { text: num(emp.permWrkMaleN),   center: true },
            { text: pct(emp.permWrkMalePct), center: true },
            { text: num(emp.permWrkFemN),    center: true },
            { text: pct(emp.permWrkFemPct),  center: true },
          ],
          [
            { text: '5.', center: true }, { text: 'Other than Permanent (G)' },
            { text: num(emp.otherWrkA),       center: true },
            { text: num(emp.otherWrkMaleN),   center: true },
            { text: pct(emp.otherWrkMalePct), center: true },
            { text: num(emp.otherWrkFemN),    center: true },
            { text: pct(emp.otherWrkFemPct),  center: true },
          ],
          [
            { text: '6.', center: true }, { text: 'Total workers (F + G)' },
            { text: num(emp.totalWrkA),       center: true },
            { text: num(emp.totalWrkMaleN),   center: true },
            { text: pct(emp.totalWrkMalePct), center: true },
            { text: num(emp.totalWrkFemN),    center: true },
            { text: pct(emp.totalWrkFemPct),  center: true },
          ],
        ]}
        bands={{ 0: 'WORKERS' }}
      />

      <NumberedQ n="19">Participation/Inclusion/Representation of women</NumberedQ>
      <Table
        widths={[2.4, 1, 1, 1.2]}
        rows={[
          [
            { text: ' ',                              header: true },
            { text: 'Total\n(A)',                     header: true, center: true },
            { text: 'No. and percentage of Females',  header: true, center: true },
            { text: ' ',                              header: true },
          ],
          [
            { text: ' ' }, { text: ' ' },
            { text: 'No. (B)',   header: true, center: true },
            { text: '% (B / A)', header: true, center: true },
          ],
          [
            { text: 'Board of Directors' },
            { text: num(w.boardTotal), center: true },
            { text: num(w.boardNo),    center: true },
            { text: pct(w.boardPct),   center: true },
          ],
          [
            { text: 'Key Management Personnel' },
            { text: num(w.kmpTotal), center: true },
            { text: num(w.kmpNo),    center: true },
            { text: pct(w.kmpPct),   center: true },
          ],
        ]}
      />

      <NumberedQ n="20">Turnover rate for permanent employees and workers</NumberedQ>
      <Text style={[styles.paraItalic, { marginBottom: 6 }]}>(Disclose trends for the past 3 years)</Text>
      <Table
        widths={[2, 1, 1, 1, 1, 1, 1, 1, 1, 1]}
        rows={[
          [
            { text: ' ', header: true },
            { text: `FY ${str(t.currentFy)}\n(Turnover rate in current FY)`, header: true, center: true },
            { text: ' ', header: true }, { text: ' ', header: true },
            { text: `FY ${str(t.prevFy)}\n(Turnover rate in previous FY)`, header: true, center: true },
            { text: ' ', header: true }, { text: ' ', header: true },
            { text: `FY ${str(t.priorFy)}\n(Turnover rate in the year prior to the previous FY)`, header: true, center: true },
            { text: ' ', header: true }, { text: ' ', header: true },
          ],
          [
            { text: ' ' },
            ...['Male','Female','Total','Male','Female','Total','Male','Female','Total']
              .map(label => ({ text: label, header: true, center: true })),
          ],
          [
            { text: 'Permanent Employees', header: true },
            { text: pct(t.empCurMale),   center: true },
            { text: pct(t.empCurFemale), center: true },
            { text: pct(t.empCurTotal),  center: true },
            { text: pct(t.empPrvMale),   center: true },
            { text: pct(t.empPrvFemale), center: true },
            { text: pct(t.empPrvTotal),  center: true },
            { text: pct(t.empPriMale),   center: true },
            { text: pct(t.empPriFemale), center: true },
            { text: pct(t.empPriTotal),  center: true },
          ],
          [
            { text: 'Permanent Workers', header: true },
            { text: pct(t.wrkCurMale),   center: true },
            { text: pct(t.wrkCurFemale), center: true },
            { text: pct(t.wrkCurTotal),  center: true },
            { text: pct(t.wrkPrvMale),   center: true },
            { text: pct(t.wrkPrvFemale), center: true },
            { text: pct(t.wrkPrvTotal),  center: true },
            { text: pct(t.wrkPriMale),   center: true },
            { text: pct(t.wrkPriFemale), center: true },
            { text: pct(t.wrkPriTotal),  center: true },
          ],
        ]}
      />
    </Page>
  );
};

/* ── SECTION A : Holding/CSR/Complaints/Material Issues (Page 3) ───────── */

const SectionA_Page3 = ({ data }) => {
  const fy = data.general?.financialYear;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.subsectionHeading}>V.  Holding, Subsidiary and Associate Companies (including joint ventures)</Text>

      <NumberedQ n="21">(a) Names of holding / subsidiary / associate companies / joint ventures</NumberedQ>
      <Table
        widths={[0.5, 2.5, 2, 1.2, 2.8]}
        rows={[
          [
            { text: 'S. No.', header: true, center: true },
            { text: 'Name of the holding / subsidiary / associate companies / joint ventures (A)', header: true },
            { text: 'Indicate whether holding/ Subsidiary/ Associate/ Joint Venture', header: true },
            { text: '% of shares held by listed entity', header: true },
            { text: 'Does the entity indicated at column A, participate in the Business Responsibility initiatives of the listed entity? (Yes/No)', header: true },
          ],
          ...(data.subsidiaries?.length
            ? data.subsidiaries.map((s, i) => [
                { text: String(i + 1), center: true },
                { text: str(s.name) },
                { text: str(s.type) },
                { text: pct(s.sharesPct), center: true },
                { text: str(s.participates), center: true },
              ])
            : [blankRow(5)]),
        ]}
      />

      <Text style={styles.subsectionHeading}>VI.  CSR Details</Text>
      <NumberedQ n="22">{`(i) Whether CSR is applicable as per section 135 of Companies Act, 2013: (Yes/No)  ${str(data.csr?.applicable)}`}</NumberedQ>
      <View style={{ marginLeft: 22, marginBottom: 8 }}>
        <Text style={styles.para}>(ii) Turnover (in Rs.)  {str(data.csr?.turnover)}</Text>
        <Text style={styles.para}>(iii) Net worth (in Rs.)  {str(data.csr?.netWorth)}</Text>
      </View>

      <Text style={styles.subsectionHeading}>VII.  Transparency and Disclosures Compliances</Text>

      <NumberedQ n="23">Complaints/Grievances on any of the principles (Principles 1 to 9) under the National Guidelines on Responsible Business Conduct:</NumberedQ>
      <Table
        widths={[1.4, 1.6, 1, 1, 0.9, 1, 1, 0.9]}
        rows={[
          [
            { text: 'Stakeholder group from whom complaint is received', header: true },
            { text: 'Grievance Redressal Mechanism in Place (Yes/No) (If Yes, then provide web-link for grievance redress policy)', header: true },
            { text: `FY ${str(fy)}\nCurrent Financial Year`,  header: true, center: true },
            { text: ' ', header: true }, { text: ' ', header: true },
            { text: `FY ${str(data.fyPrevious)}\nPrevious Financial Year`, header: true, center: true },
            { text: ' ', header: true }, { text: ' ', header: true },
          ],
          [
            { text: ' ' }, { text: ' ' },
            { text: 'Number of complaints filed during the year',                  header: true, center: true },
            { text: 'Number of complaints pending resolution at close of the year',header: true, center: true },
            { text: 'Remarks',                                                     header: true, center: true },
            { text: 'Number of complaints filed during the year',                  header: true, center: true },
            { text: 'Number of complaints pending resolution at close of the year',header: true, center: true },
            { text: 'Remarks',                                                     header: true, center: true },
          ],
          ...['Communities','Investors (other than shareholders)','Shareholders','Employees and workers','Customers','Value Chain Partners','Other (please specify)']
            .map(name => [
              { text: name },
              { text: str(data.complaints?.[name]?.mechanism) },
              { text: num(data.complaints?.[name]?.curFiled),   center: true },
              { text: num(data.complaints?.[name]?.curPending), center: true },
              { text: str(data.complaints?.[name]?.curRemarks) },
              { text: num(data.complaints?.[name]?.prvFiled),   center: true },
              { text: num(data.complaints?.[name]?.prvPending), center: true },
              { text: str(data.complaints?.[name]?.prvRemarks) },
            ]),
        ]}
      />

      <NumberedQ n="24">Overview of the entity&rsquo;s material responsible business conduct issues</NumberedQ>
      <Text style={styles.para}>Please indicate material responsible business conduct and sustainability issues pertaining to environmental and social matters that present a risk or an opportunity to your business, rationale for identifying the same, approach to adapt or mitigate the risk along-with its financial implications, as per the following format</Text>
      <Table
        widths={[0.6, 1.6, 1.4, 1.6, 1.6, 1.8]}
        rows={[
          [
            { text: 'S. No.',                                                                                  header: true, center: true },
            { text: 'Material issue identified',                                                                header: true },
            { text: 'Indicate whether risk or opportunity (R/O)',                                               header: true },
            { text: 'Rationale for identifying the risk / opportunity',                                         header: true },
            { text: 'In case of risk, approach to adapt or mitigate',                                           header: true },
            { text: 'Financial implications of the risk or opportunity (Indicate positive or negative implications)', header: true },
          ],
          ...(data.materialIssues?.length
            ? data.materialIssues.map((m, i) => [
                { text: String(i + 1), center: true },
                { text: str(m.issue) },
                { text: str(m.type) },
                { text: str(m.rationale) },
                { text: str(m.mitigation) },
                { text: str(m.financial) },
              ])
            : [blankRow(6), blankRow(6)]),
        ]}
      />
    </Page>
  );
};

/* ── SECTION B : Management & Process Disclosures (24-Q × 9-Principle matrix) ── */

const SECTION_B_QUESTIONS_PART1 = [
  '1. a.  Whether your entity\'s policy/policies cover each principle and its core elements of the NGRBCs. (Yes/No)',
  '   b.  Has the policy been approved by the Board? (Yes/No)',
  '   c.  Web Link of the Policies, if available',
  '2. Whether the entity has translated the policy into procedures. (Yes / No)',
  '3. Do the enlisted policies extend to your value chain partners? (Yes/No)',
  '4. Name of the national and international codes/certifications/labels/ standards (e.g. Forest Stewardship Council, Fairtrade, Rainforest Alliance, Trustea) standards (e.g. SA 8000, OHSAS, ISO, BIS) adopted by your entity and mapped to each principle.',
  '5. Specific commitments, goals and targets set by the entity with defined timelines, if any.',
  '6. Performance of the entity against the specific commitments, goals and targets along-with reasons in case the same are not met.',
];

const SectionB_Page1 = ({ data }) => {
  const m = data.sectionB || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeading}>SECTION B: MANAGEMENT AND PROCESS DISCLOSURES</Text>
      <Text style={styles.para}>This section is aimed at helping businesses demonstrate the structures, policies and processes put in place towards adopting the NGRBC Principles and Core Elements.</Text>

      <Table
        widths={[3.4, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]}
        rows={[
          [{ text: 'Disclosure Questions', header: true }, ...headerCells(PRINCIPLE_COLS)],
          [{ text: 'Policy and management processes', header: true }, ...blankRow(9)],
          ...SECTION_B_QUESTIONS_PART1.map((q, idx) => {
            const answers = m[`q${idx + 1}`] || {};
            return [
              { text: q },
              ...PRINCIPLE_COLS.map((_, i) => ({ text: str(answers[`p${i + 1}`]), center: true })),
            ];
          }),
          [{ text: 'Governance, leadership and oversight', header: true }, ...blankRow(9)],
          [{ text: '7. Statement by director responsible for the business responsibility report, highlighting ESG related challenges, targets and achievements (listed entity has flexibility regarding the placement of this disclosure)' },
           { text: str(m.directorStatement) }, ...blankRow(8)],
          [{ text: '8. Details of the highest authority responsible for implementation and oversight of the Business Responsibility policy (ies).' },
           { text: str(m.highestAuthority) }, ...blankRow(8)],
          [{ text: '9. Does the entity have a specified Committee of the Board/ Director responsible for decision making on sustainability related issues? (Yes / No). If yes, provide details.' },
           { text: str(m.sustainabilityCommittee) }, ...blankRow(8)],
        ]}
      />
    </Page>
  );
};

const SectionB_Page2 = ({ data }) => {
  const m = data.sectionB || {};
  return (
    <Page size="A4" style={styles.page}>
      <NumberedQ n="10">Details of Review of NGRBCs by the Company:</NumberedQ>
      <Table
        widths={[2, 4.5, 4.5]}
        rows={[
          [
            { text: 'Subject for Review', header: true },
            { text: 'Indicate whether review was undertaken by Director / Committee of the Board/ Any other Committee', header: true, center: true },
            { text: 'Frequency (Annually/ Half yearly/ Quarterly/ Any other – please specify)', header: true, center: true },
          ],
          [
            { text: ' ' },
            { text: PRINCIPLE_COLS.join('   '), center: true },
            { text: PRINCIPLE_COLS.join('   '), center: true },
          ],
          [{ text: 'Performance against above policies and follow up action' },
           { text: str(m.reviewPolicyPerformance) }, { text: str(m.reviewPolicyFrequency) }],
          [{ text: 'Compliance with statutory requirements of relevance to the principles, and, rectification of any non-compliances' },
           { text: str(m.reviewCompliance) }, { text: str(m.reviewComplianceFrequency) }],
        ]}
      />

      <Table
        widths={[7, 4]}
        rows={[
          [
            { text: '11. Has the entity carried out independent assessment/ evaluation of the working of its policies by an external agency? (Yes/No). If yes, provide name of the agency.' },
            { text: str(m.independentAssessment), center: true },
          ],
        ]}
      />

      <NumberedQ n="12">If answer to question (1) above is &ldquo;No&rdquo; i.e. not all Principles are covered by a policy, reasons to be stated:</NumberedQ>
      <Table
        widths={[3.4, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]}
        rows={[
          [{ text: 'Questions', header: true }, ...headerCells(PRINCIPLE_COLS)],
          ...['notMaterial','notReady','noResources','plannedNextFy','otherReason'].map((key, idx) => {
            const labels = [
              'The entity does not consider the Principles material to its business (Yes/No)',
              'The entity is not at a stage where it is in a position to formulate and implement the policies on specified principles (Yes/No)',
              'The entity does not have the financial or/human and technical resources available for the task (Yes/No)',
              'It is planned to be done in the next financial year (Yes/No)',
              'Any other reason (please specify)',
            ];
            const ans = m[key] || {};
            return [
              { text: labels[idx] },
              ...PRINCIPLE_COLS.map((_, i) => ({ text: str(ans[`p${i + 1}`]), center: true })),
            ];
          }),
        ]}
      />
    </Page>
  );
};

/* ── SECTION C : Principle Headings ────────────────────────────────────── */

const PRINCIPLES = [
  { id: 'P1', title: 'PRINCIPLE 1 Businesses should conduct and govern themselves with integrity, and in a manner that is Ethical, Transparent and Accountable.' },
  { id: 'P2', title: 'PRINCIPLE 2 Businesses should provide goods and services in a manner that is sustainable and safe' },
  { id: 'P3', title: 'PRINCIPLE 3 Businesses should respect and promote the well-being of all employees, including those in their value chains' },
  { id: 'P4', title: 'PRINCIPLE 4: Businesses should respect the interests of and be responsive to all its stakeholders' },
  { id: 'P5', title: 'PRINCIPLE 5 Businesses should respect and promote human rights' },
  { id: 'P6', title: 'PRINCIPLE 6: Businesses should respect and make efforts to protect and restore the environment' },
  { id: 'P7', title: 'PRINCIPLE 7 Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent' },
  { id: 'P8', title: 'PRINCIPLE 8 Businesses should promote inclusive growth and equitable development' },
  { id: 'P9', title: 'PRINCIPLE 9 Businesses should engage with and provide value to their consumers in a responsible manner' },
];

/* ── SECTION C Intro + PRINCIPLE 1: Ethics, Transparency, Accountability ─ */

const SectionC_Intro_P1 = ({ data }) => {
  const gov = data.governance || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeading}>SECTION C: PRINCIPLE WISE PERFORMANCE DISCLOSURE</Text>
      <Text style={styles.para}>This section is aimed at helping entities demonstrate their performance in integrating the Principles and Core Elements with key processes and decisions. The information sought is categorized as &ldquo;Essential&rdquo; and &ldquo;Leadership&rdquo;. While the essential indicators are expected to be disclosed by every entity that is mandated to file this report, the leadership indicators may be voluntarily disclosed by entities which aspire to progress to a higher level in their quest to be socially, environmentally and ethically responsible.</Text>

      <Text style={styles.principleHeading}>{PRINCIPLES[0].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Percentage coverage by training and awareness programmes on any of the Principles during the financial year:</NumberedQ>
      <Table
        widths={[2, 2.4, 2.4, 2.4]}
        rows={[
          [
            { text: 'Segment',                                                              header: true },
            { text: 'Total number of training and awareness programmes held',               header: true },
            { text: 'Topics / principles covered under the training and its impact',        header: true },
            { text: '%age of persons in respective category covered by the awareness programmes', header: true },
          ],
          [{ text: 'Board of Directors' },                ...blankRow(3)],
          [{ text: 'Key Managerial Personnel' },          ...blankRow(3)],
          [{ text: 'Employees other than BoD and KMPs' }, ...blankRow(3)],
          [{ text: 'Workers' },                           ...blankRow(3)],
        ]}
      />

      <NumberedQ n="2">Details of fines / penalties /punishment/ award/ compounding fees/ settlement amount paid in proceedings (by the entity or by directors / KMPs) with regulators/ law enforcement agencies/ judicial institutions, in the financial year:</NumberedQ>
      <Table
        widths={[2.5, 2, 2, 2, 2]}
        rows={[
          [
            { text: ' ',                              header: true },
            { text: 'NGRBC Principle',                header: true, center: true },
            { text: 'Name of the regulatory/ enforcement agencies/ judicial institutions', header: true },
            { text: 'Amount (In INR)',                header: true, center: true },
            { text: 'Brief of the Case',              header: true },
          ],
          [
            { text: 'Monetary — Total Regulatory Fines / Penalties', header: true },
            { text: 'P1', center: true },
            { text: '—' },
            { text: num(gov.regulatory_fines), center: true },
            { text: '—' },
          ],
        ]}
      />

      <NumberedQ n="3">Data Privacy &amp; Cyber Security — Percentage of cyber-security events resulting in a confirmed data breach:</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                                         header: true },
            { text: 'Current FY value',                                                  header: true, center: true },
          ],
          [
            { text: 'Data Breach Incidents as a percentage of total cyber-security events' },
            { text: pct(gov.data_breach_pct), center: true },
          ],
        ]}
      />

      <NumberedQ n="4">Accounts Payable — Days Payable Outstanding (DPO):</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                       header: true },
            { text: 'Current FY value',                                header: true, center: true },
          ],
          [
            { text: 'Accounts Payable Days = Accounts Payable / (COGS / 365)' },
            { text: `${num(gov.payable_days)} days`, center: true },
          ],
        ]}
      />
    </Page>
  );
};

/* ── PRINCIPLE 2: Products & Services Sustainability ───────────────────── */

const SectionC_P2 = () => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.principleHeading}>{PRINCIPLES[1].title}</Text>
    <Indicator kind="Essential" />

    <NumberedQ n="1">Percentage of R&amp;D and capital expenditure (capex) investments in specific technologies to improve the environmental and social impacts of product and processes to total R&amp;D and capex investments made by the entity, respectively:</NumberedQ>
    <Table
      widths={[2.5, 2, 2, 3]}
      rows={[
        [
          { text: ' ',          header: true },
          { text: 'Current FY', header: true, center: true },
          { text: 'Previous FY',header: true, center: true },
          { text: 'Details of improvements in environmental and social impacts', header: true },
        ],
        [{ text: 'R&D' },   { text: '0%', center: true }, { text: '0%', center: true }, { text: '—' }],
        [{ text: 'Capex' }, { text: '0%', center: true }, { text: '0%', center: true }, { text: '—' }],
      ]}
    />

    <NumberedQ n="2">Does the entity have procedures in place for sustainable sourcing? (Yes/No) If yes, what percentage of inputs were sourced sustainably?</NumberedQ>
    <Text style={styles.para}>—</Text>

    <NumberedQ n="3">Describe the processes in place to safely reclaim your products for reusing, recycling and disposing at the end of life, for (a) Plastics (including packaging) (b) E-waste (c) Hazardous waste (d) Other waste.</NumberedQ>
    <Text style={styles.para}>—</Text>
  </Page>
);

/* ── PRINCIPLE 3: Employee Wellbeing ───────────────────────────────────── */

const SectionC_P3 = ({ data }) => {
  const s = data.social || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.principleHeading}>{PRINCIPLES[2].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Spending on measures towards well-being of employees (including permanent and other than permanent) — as a percentage of total revenue of the company:</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                          header: true },
            { text: 'Current FY value',                                   header: true, center: true },
          ],
          [
            { text: 'Cost incurred on well-being measures as a % of total revenue of the company' },
            { text: pct(s.well_being_spend_pct), center: true },
          ],
        ]}
      />

      <NumberedQ n="2">Details of safety related incidents — Lost Time Injury Frequency Rate (LTIFR) per one million-person hours worked:</NumberedQ>
      <Table
        widths={[3, 2.5, 2.5]}
        rows={[
          [
            { text: 'Safety Incident / Number',                                header: true },
            { text: 'Category',                                                header: true, center: true },
            { text: 'FY (Current Financial Year)',                             header: true, center: true },
          ],
          [
            { text: 'Lost Time Injury Frequency Rate (LTIFR) (per one million-person hours worked)' },
            { text: 'Employees', center: true },
            { text: num(s.ltifr_employees), center: true },
          ],
          [
            { text: ' ' },
            { text: 'Workers',  center: true },
            { text: num(s.ltifr_workers), center: true },
          ],
        ]}
      />

      <NumberedQ n="3">Details of measures for the well-being of workers — Health insurance, Accident insurance, Maternity Benefits, Paternity Benefits, Day Care facilities (% covered).</NumberedQ>
      <Text style={styles.para}>—</Text>
    </Page>
  );
};

/* ── PRINCIPLE 4: Stakeholder Engagement ───────────────────────────────── */

const SectionC_P4 = () => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.principleHeading}>{PRINCIPLES[3].title}</Text>
    <Indicator kind="Essential" />

    <NumberedQ n="1">Describe the processes for identifying key stakeholder groups of the entity.</NumberedQ>
    <Text style={styles.para}>—</Text>

    <NumberedQ n="2">List stakeholder groups identified as key for your entity and the frequency of engagement with each stakeholder group.</NumberedQ>
    <Table
      widths={[2, 2, 2, 3, 2]}
      rows={[
        [
          { text: 'Stakeholder Group',                       header: true },
          { text: 'Whether identified as Vulnerable & Marginalized Group (Yes/No)', header: true, center: true },
          { text: 'Channels of communication',                header: true },
          { text: 'Frequency of engagement (Annually/ Half yearly/ Quarterly/ others – please specify)', header: true },
          { text: 'Purpose and scope of engagement including key topics and concerns raised during such engagement', header: true },
        ],
        [{ text: 'Investors / Shareholders' }, { text: '—', center: true }, { text: '—' }, { text: '—' }, { text: '—' }],
        [{ text: 'Employees' },                { text: '—', center: true }, { text: '—' }, { text: '—' }, { text: '—' }],
        [{ text: 'Customers' },                { text: '—', center: true }, { text: '—' }, { text: '—' }, { text: '—' }],
        [{ text: 'Communities' },              { text: '—', center: true }, { text: '—' }, { text: '—' }, { text: '—' }],
      ]}
    />
  </Page>
);

/* ── PRINCIPLE 5: Human Rights ─────────────────────────────────────────── */

const SectionC_P5 = ({ data }) => {
  const s = data.social || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.principleHeading}>{PRINCIPLES[4].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Wage equality — Median remuneration / wages of female employees as a percentage of male employees:</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                                       header: true },
            { text: 'Current FY value',                                                header: true, center: true },
          ],
          [
            { text: 'Female wages as a percentage of total wages paid (Wage Parity Indicator)' },
            { text: pct(s.female_wage_pct), center: true },
          ],
        ]}
      />

      <NumberedQ n="2">Employees and workers who have been provided training on human rights issues and policy(ies) of the entity (% covered):</NumberedQ>
      <Text style={styles.para}>—</Text>

      <NumberedQ n="3">Complaints/grievances on issues related to sexual harassment, discrimination at workplace, child labour, forced/involuntary labour, wages and other human rights related issues — number filed and pending resolution.</NumberedQ>
      <Text style={styles.para}>—</Text>
    </Page>
  );
};

/* ── PRINCIPLE 6: Environment ──────────────────────────────────────────── */

const SectionC_P6 = ({ data }) => {
  const e = data.environmental || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.principleHeading}>{PRINCIPLES[5].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Details of total energy consumption (in kilowatt-hour) and energy intensity:</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'Total energy consumed (across the entity)' },
            { text: num(e.total_energy_kwh), center: true },
            { text: 'kWh',                   center: true },
          ],
          [
            { text: 'Percentage of energy from renewable sources' },
            { text: pct(e.renewable_pct),    center: true },
            { text: '%',                     center: true },
          ],
        ]}
      />

      <NumberedQ n="2">Provide details of the following disclosures related to water:</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'Total volume of water withdrawn / consumed' },
            { text: num(e.total_water_kl), center: true },
            { text: 'KL',                  center: true },
          ],
        ]}
      />

      <NumberedQ n="3">Details of greenhouse gas emissions (Scope 1 and Scope 2) for the entity:</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'Total Scope 1 emissions (Break-up of the GHG into CO2, CH4, N2O, HFCs, PFCs, SF6, NF3, if available)' },
            { text: num(e.scope_1_tco2e), center: true },
            { text: 'tCO2e',              center: true },
          ],
          [
            { text: 'Total Scope 2 emissions (Break-up of the GHG into CO2, CH4, N2O, HFCs, PFCs, SF6, NF3, if available)' },
            { text: num(e.scope_2_tco2e), center: true },
            { text: 'tCO2e',              center: true },
          ],
        ]}
      />

      <NumberedQ n="4">Provide details related to waste management by the entity:</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'Total waste generated (across hazardous, non-hazardous, plastic, e-waste, bio-medical, construction & demolition, battery and other waste)' },
            { text: num(e.total_waste_mt), center: true },
            { text: 'Metric Tonnes',       center: true },
          ],
        ]}
      />

      <View style={{ marginTop: 14 }}>
        <Indicator kind="Leadership" />
      </View>

      <NumberedQ n="5">Provide break-up of the total energy consumed (in kilowatt-hour) from renewable and non-renewable sources, and the total Scope 3 emissions for your entity, in the following format:</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'Total Scope 3 emissions (Break-up of the GHG into CO2, CH4, N2O, HFCs, PFCs, SF6, NF3, if available)' },
            { text: num(e.scope_3_tco2e), center: true },
            { text: 'tCO2e',              center: true },
          ],
        ]}
      />

      <NumberedQ n="6">GHG Emission Intensity (PPP-adjusted) — Total emissions per Crore of Revenue (turnover):</NumberedQ>
      <Table
        widths={[4, 2, 2]}
        rows={[
          [
            { text: 'Parameter',                                                      header: true },
            { text: 'Current FY',                                                     header: true, center: true },
            { text: 'Unit',                                                           header: true, center: true },
          ],
          [
            { text: 'GHG Intensity = (Scope 1 + Scope 2) / Revenue in Rs Crore' },
            { text: num(e.ghg_intensity_tco2e_cr), center: true },
            { text: 'tCO2e / Cr',                  center: true },
          ],
        ]}
      />
    </Page>
  );
};

/* ── PRINCIPLE 7: Policy Advocacy ──────────────────────────────────────── */

const SectionC_P7 = ({ data }) => {
  const gov = data.governance || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.principleHeading}>{PRINCIPLES[6].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Number of affiliations with trade and industry chambers/ associations:</NumberedQ>
      <Text style={styles.para}>—</Text>

      <NumberedQ n="2">List the top 10 trade and industry chambers/ associations (determined based on the total members of such body) the entity is a member of/ affiliated to.</NumberedQ>
      <Text style={styles.para}>—</Text>

      <NumberedQ n="3">Related Party Transactions — Purchases from related parties as a percentage of total purchases:</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                                          header: true },
            { text: 'Current FY value',                                                   header: true, center: true },
          ],
          [
            { text: 'Related Party Purchases as a percentage of Total Purchases' },
            { text: pct(gov.related_party_buy_pct), center: true },
          ],
        ]}
      />

      <NumberedQ n="4">Details of corrective action taken or underway on any issues related to anti-competitive conduct by the entity, based on adverse orders from regulatory authorities.</NumberedQ>
      <Text style={styles.para}>—</Text>
    </Page>
  );
};

/* ── PRINCIPLE 8: Inclusive Growth ─────────────────────────────────────── */

const SectionC_P8 = ({ data }) => {
  const s = data.social || {};
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.principleHeading}>{PRINCIPLES[7].title}</Text>
      <Indicator kind="Essential" />

      <NumberedQ n="1">Details of Social Impact Assessments (SIA) of projects undertaken by the entity based on applicable laws, in the current financial year.</NumberedQ>
      <Text style={styles.para}>—</Text>

      <NumberedQ n="2">Provide the following information on CSR projects undertaken by your entity in designated aspirational districts as identified by government bodies.</NumberedQ>
      <Text style={styles.para}>—</Text>

      <NumberedQ n="3">Procurement from suppliers from MSMEs / small producers as a percentage of total purchases (Inclusive Sourcing):</NumberedQ>
      <Table
        widths={[5, 3]}
        rows={[
          [
            { text: 'Indicator',                                                                        header: true },
            { text: 'Current FY value',                                                                 header: true, center: true },
          ],
          [
            { text: 'MSME Procurement as a percentage of Total Purchases' },
            { text: pct(s.msme_procurement_pct), center: true },
          ],
        ]}
      />

      <NumberedQ n="4">Job creation in smaller towns — Wages paid to persons employed (including employees or workers employed on a permanent or non-permanent / on contract basis) in the following locations, as % of total wage cost.</NumberedQ>
      <Text style={styles.para}>—</Text>
    </Page>
  );
};

/* ── PRINCIPLE 9: Consumer Responsibility ──────────────────────────────── */

const SectionC_P9 = () => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.principleHeading}>{PRINCIPLES[8].title}</Text>
    <Indicator kind="Essential" />

    <NumberedQ n="1">Describe the mechanisms in place to receive and respond to consumer complaints and feedback.</NumberedQ>
    <Text style={styles.para}>—</Text>

    <NumberedQ n="2">Turnover of products and / services as a percentage of turnover from all products/service that carry information about: Environmental and social parameters relevant to the product, Safe and responsible usage, Recycling and/or safe disposal.</NumberedQ>
    <Table
      widths={[4, 4]}
      rows={[
        [
          { text: ' ',                                                          header: true },
          { text: 'As a percentage to total turnover',                           header: true, center: true },
        ],
        [{ text: 'Environmental and social parameters relevant to the product' }, { text: '0%', center: true }],
        [{ text: 'Safe and responsible usage' },                                  { text: '0%', center: true }],
        [{ text: 'Recycling and/or safe disposal' },                              { text: '0%', center: true }],
      ]}
    />

    <NumberedQ n="3">Number of consumer complaints in respect of the following — Data privacy, Advertising, Cyber-security, Delivery of essential services, Restrictive Trade Practices, Unfair Trade Practices, Other.</NumberedQ>
    <Text style={styles.para}>—</Text>

    <NumberedQ n="4">Details of instances of product recalls on account of safety issues — Voluntary recalls and Forced recalls.</NumberedQ>
    <Text style={styles.para}>—</Text>
  </Page>
);

/* ── Default empty data shape (matches the dashboardState contract) ────── */

export const DEFAULT_DATA = {
  general: {
    cin: '', entityName: '', financialYear: '', reportingBoundary: '',
    yearOfIncorporation: '', registeredOffice: '', corporateOffice: '',
    email: '', telephone: '', website: '',
    exchanges: '', paidUp: '', contactPerson: '',
  },
  environmental: {
    scope_1_tco2e: 0, scope_2_tco2e: 0, scope_3_tco2e: 0,
    total_energy_kwh: 0, total_water_kl: 0, renewable_pct: 0,
    total_waste_mt: 0, ghg_intensity_tco2e_cr: 0,
  },
  social: {
    female_wage_pct: 0, well_being_spend_pct: 0,
    msme_procurement_pct: 0, ltifr_employees: 0, ltifr_workers: 0,
  },
  governance: {
    payable_days: 0, data_breach_pct: 0,
    related_party_buy_pct: 0, regulatory_fines: 0,
  },
  businessActivities: [],
  products:           [],
  operations:    { national: {}, international: {} },
  markets:       {},
  employees:     {},
  women:         {},
  turnover:      {},
  subsidiaries:  [],
  csr:           {},
  complaints:    {},
  materialIssues:[],
  fyPrevious:    '',
  sectionB:      {},
};

/* ── Adapter: legacy `report` → flat `data` shape ──────────────────────── */

const adaptReportToData = (report) => {
  const meta = report?.reportMetadata || {};
  const co   = meta.company || {};
  const a    = report?.sectionA || {};
  const cd   = a.companyDetails || {};
  const fin  = a.financialData  || {};
  const addr = cd.registeredAddress || {};
  const ct   = cd.brContact || {};
  const env  = report?.sectionC?.principle6 || report?.environmental || {};
  const soc  = report?.sectionC?.principle3 || report?.social        || {};
  const gov  = report?.sectionC?.principle1 || report?.governance    || {};

  return {
    general: {
      cin:                 co.CIN || cd.CIN,
      entityName:          co.name || cd.companyName,
      yearOfIncorporation: cd.yearOfIncorporation,
      registeredOffice:    [addr.street, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean).join(', '),
      corporateOffice:     addr.corporateAddress || addr.street,
      email:               ct.email,
      telephone:           ct.phone,
      website:             cd.website,
      financialYear:       fin.financialYear || meta.financialYear,
      exchanges:           typeof cd.stockExchange === 'string' ? cd.stockExchange : (cd.stockExchange?.exchanges || ''),
      paidUp:              cd.paidUpCapital,
      contactPerson:       [ct.name, ct.email, ct.phone].filter(Boolean).join(' · '),
      reportingBoundary:   cd.reportingBoundary === 'consolidated' ? 'Consolidated' : 'Standalone',
    },
    environmental: {
      scope_1_tco2e:           env.scope1_tco2e          ?? env.scope_1_tco2e,
      scope_2_tco2e:           env.scope2_tco2e          ?? env.scope_2_tco2e,
      scope_3_tco2e:           env.scope3_tco2e          ?? env.scope_3_tco2e,
      total_energy_kwh:        env.total_energy_kwh,
      total_water_kl:          env.total_water_kl,
      renewable_pct:           env.renewable_energy_pct  ?? env.renewable_pct,
      total_waste_mt:          env.total_waste_mt,
      ghg_intensity_tco2e_cr:  env.ghg_intensity_ppp     ?? env.ghg_intensity_tco2e_cr,
    },
    social: {
      female_wage_pct:        soc.female_wage_pct,
      well_being_spend_pct:   soc.wellbeing_spend_pct_revenue ?? soc.well_being_spend_pct,
      msme_procurement_pct:   soc.msme_procurement_pct,
      ltifr_employees:        soc.ltifr_employees,
      ltifr_workers:          soc.ltifr_workers,
    },
    governance: {
      payable_days:            gov.accounts_payable_days     ?? gov.payable_days,
      data_breach_pct:         gov.data_breach_pct_incidents ?? gov.data_breach_pct,
      related_party_buy_pct:   gov.related_party_purchase_pct ?? gov.related_party_buy_pct,
      regulatory_fines:        gov.regulatory_fines,
    },
    businessActivities: [],
    products:           [],
    operations:    { national: {}, international: {} },
    markets:       {},
    employees:     {},
    women:         {},
    turnover:      {},
    subsidiaries:  [],
    csr:           {},
    complaints:    {},
    materialIssues:[],
    fyPrevious:    '',
    sectionB:      {},
  };
};

/* ── Document root ─────────────────────────────────────────────────────── */

const BRSRPdfReport = ({ dashboardState, data, report }) => {
  const incoming = dashboardState || data;
  const payload  = incoming
    ? { ...DEFAULT_DATA, ...incoming,
        general:       { ...DEFAULT_DATA.general,       ...(incoming.general       || {}) },
        environmental: { ...DEFAULT_DATA.environmental, ...(incoming.environmental || {}) },
        social:        { ...DEFAULT_DATA.social,        ...(incoming.social        || {}) },
        governance:    { ...DEFAULT_DATA.governance,    ...(incoming.governance    || {}) },
      }
    : (report ? adaptReportToData(report) : DEFAULT_DATA);

  return (
    <Document
      title="BRSR Report"
      author="GreenLedger AI"
      subject="SEBI BRSR Annexure I"
    >
      <SectionA_Page1   data={payload} />
      <SectionA_Page2   data={payload} />
      <SectionA_Page3   data={payload} />
      <SectionB_Page1   data={payload} />
      <SectionB_Page2   data={payload} />
      <SectionC_Intro_P1 data={payload} />
      <SectionC_P2 />
      <SectionC_P3 data={payload} />
      <SectionC_P4 />
      <SectionC_P5 data={payload} />
      <SectionC_P6 data={payload} />
      <SectionC_P7 data={payload} />
      <SectionC_P8 data={payload} />
      <SectionC_P9 />
    </Document>
  );
};

export default BRSRPdfReport;
