/**
 * populate-word-assembly-combinations.ts
 *
 * Finds up to 50 exact combinations of word derivatives whose letters consume
 * an eligible base word exactly once, excluding the listed three-letter words,
 * then stores the component rows in word_assembly_components.
 *
 * Usage:
 *   npx tsx scripts/populate-word-assembly-combinations.ts
 *   npx tsx scripts/populate-word-assembly-combinations.ts --dry-run
 *
 * Configure DB_URL, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in .env first.
 */

import "dotenv/config";
import { and, asc, eq, exists, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import * as schema from "../server/db-schema";
import { getMySQLConnectionConfig } from "../server/mysql-config";

const BASE_WORD_BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 1_000;
export const MAX_COMBINATIONS_PER_BASE_WORD = 200;
const COMMON_FREQUENCY_LEVELS = [
  "medium_low",
  "medium",
  "medium_high",
  "high",
  "very_high",
] as const;
const EXCLUDED_THREE_LETTER_WORDS = new Set<string>([
  "AAH", "AAL", "AAM", "AAS", "ABB", "ABD", "ABE", "ABL", "ABN", "ABO",
  "ABP", "ABR", "ABS", "ABT", "ABU", "ABV", "ABY", "ACC", "ACH", "ACK",
  "ACY", "ADC", "ADE", "ADJ", "ADM", "ADP", "ADS", "ADV", "ADY", "ADZ",
  "AEQ", "AER", "AES", "AET", "AFB", "AFD", "AFF", "AFT", "AGR", "AGT",
  "AGY", "AHI", "AHO", "AHS", "AHT", "AHU", "AIK", "AIL", "AIN", "AIS",
  "AIT", "AIX", "AKA", "AKE", "AKO", "AKU", "ALB", "ALC", "ALD", "ALF",
  "ALG", "ALK", "ALN", "ALO", "ALP", "ALS", "ALT", "ALW", "ALY", "AMA",
  "AMB", "AME", "AMI", "AMP", "AMT", "AMU", "AMY", "ANC", "ANE", "ANI",
  "ANN", "ANS", "AOB", "AOR", "APA", "APH", "APL", "APR", "APX", "ARA",
  "ARB", "ARF", "ARG", "ARN", "ARO", "ARR", "ARS", "ARU", "ARX", "ARY",
  "ASA", "ASB", "ASE", "ASG", "ASP", "AST", "ATA", "ATI", "ATM", "ATT",
  "AUD", "AUF", "AUG", "AUH", "AUK", "AUL", "AUM", "AUS", "AUX", "AVA",
  "AVE", "AVG", "AVN", "AVO", "AWA", "AWD", "AWK", "AWL", "AWM", "AWN",
  "AYS", "AYU", "AZO", "BAA", "BAB", "BAE", "BAH", "BAI", "BAW", "BBL",
  "BBS", "BCD", "BCF", "BCH", "BDE", "BDL", "BDS", "BEA", "BEC", "BEF",
  "BER", "BES", "BHD", "BHP", "BIM", "BKG", "BKS", "BKT", "BLD", "BLK",
  "BLO", "BLS", "BNF", "BOC", "BOE", "BOH", "BOL", "BOM", 
  "BOR", "BOS", "BPI", "BPS", "BPT",
  "BRL", "BRR", "BSF", "BSH", "BTL", "BTU", 
  "BUL", "BUR", "BUZ", "BVT", "BXS", 
  "BYP", "BYS", "CAF", "CAG", "CAI", "CAL", "CAV",
  "CAW", "CCM", "CCW", "CDF", "CDG", "CDR", "CEE", "CEN", "CEP",
  "CFD", "CFH", "CFI", "CFM", "CFS", "CGM", "CGS", "CHA", "CHE", "CHG",
  "CHI", "CHM", "CHN", "CHO", "CHS", "CIA", "CID", "CIE", "CIF", "CIG",
  "CIR", "CIS", "CIT", "CIV", "CKW", "CLI", "CLK", "CLO", "CLR", "CLY",
  "CMD", "CML", "COE", "COM", 
  "COR", "COS", "COZ", "CPD", "CPI",
  "CPL", "CPM", "CPO", "CPS", "CPT", "CPU", "CRC", "CRE", "CRL", "CRO",
  "CRS", "CRU", "CSC", "CSI", "CSK", "CSP", "CST", "CSW", "CTE",
  "CTF", "CTG", "CTN", "CTO", "CTR", "CTS", "CUJ",
  "CUL", "CUR", "CWM", "CWO", "CWT", "CYC",
  "CYL", "CYP", "DAE", "DAG", "DAH", "DAK", "DAL", 
  "DAO", "DAR", "DAS", "DAT", "DAU", "DAW", "DAY", "DBL", "DCA",
  "DCB", "DDT", "DEA", "DEB", "DEC", "DEE", "DEF", "DEG", "DEI", "DEL",
  "DEM", "DEP", "DER", "DES", "DET", "DEV", "DEX", "DEY",
  "DFT", "DHA", "DHU", "DIA", "DIF", "DIG", "DIL",
  "DIR", "DIS", "DIT", "DIV", "DIX", "DKG", "DKL",
  "DKM", "DKS", "DLR", "DOA", "DOB", "DOC", "DOD", "DOW", 
  "DOL", "DOO", "DOR", "DOS", "DOW", "DOZ",
  "DPT", "DSP", "DSR", "DTD", "DUC", 
  "DUI", "DUP", "DUR", "DWT", "DYN",
  "DYS", "DZO", "EAD", "EAM", "EAN", "EAU", "ECB",
  "ECU", "EDH", "EDO", "EDP", "EDS", "EEN", "EER", "EFF",
  "EFL", "EFS", "EFT", "EIR", "EKE", "ELA", "ELB", "ELD",
  "ELF", "ELI", "ELK", "ELL", "ELM", "ELS", "ELT", "EME", "EMF", "EMM",
  "EMP", "EMS", "EMU", "ENC", "ENG", "ENL", "ENS", "ENV", "EOF",
  "EOM", "EOS", "EPA", "EPI", "ERD", "ERE", "ERF", "ERG",
  "ERK", "ERR", "ERS", "ESC", "ESD", "ESE", "ESP", "ESQ", "ESS",
  "EST", "ESU", "ETA", "ETC", "ETH", "ETY", "EVA", "EVG", "EWE",
  "EXP", "EXR", "EXT", "EYL", "EYN", "EYR", "FAC",
  "FAE", "FAQ", "FAS", 
  "FBI", "FCP", "FCS", "FCY", "FEC", "FED", "FEE", "FEH", "FEI", 
  "FEN", "FER", "FET", "FEU", "FEW", "FEY", "FEZ", "FFA", "FGN", 
  "FIE", "FIL", "FIP", "FIR", "FIZ",
  "FLB", "FLD", "FLL", "FLO", "FMT", "FOD", 
  "FOH", "FOL", "FON", "FOO", "FOP", "FOT", "FOU", "FOW",
  "FOY", "FPM", "FPS", "FRA", "FRS", "FRT", "FRY", "FTH",
  "FUB", "FUD", "FUM", "FUT", "FWD", 
  "GAE", "GAJ", "GAN", 
  "GAU", "GAW", "GAY", "GAZ", "GCD", "GDS", "GEB", "GED", "GEE", "GEL",
  "GER", "GES", "GEY", "GEZ", "GGR", "GHI",
  "GIE", "GIL", "GIM", "GIO", "GIP",
  "GIS", "GIT", "GLB", "GLD", "GLT", "GNS", "GNU", "GOA", "GOB", 
  "GOI", "GOL", "GON", "GOR", "GOS", "GOT", "GOU", "GOV",
  "GOX", "GOY", "GPD", "GPH", "GPM", "GPS", "GRA", "GRE", "GRF", "GRO",
  "GRR", "GRS", "GRX", "GRY", "GTC", "GTD", "GTE", "GTT", "GUD", "GUE",
  "GUL", "GUP", "GUR", "GUS", "GUV", "GUZ",
  "GYE", "GYN", "GYP", "HAB", "HAE", "HAF", "HAH", "HAJ",
  "HAK", "HAL", "HAN", "HAO", "HAU", "HAV",
  "HCB", "HCF", "HCL", "HED", "HEE", "HEH", "HEI", "HEL",
  "HEO", "HES", 
  "HGT", "HHD", "HIA", "HIE", 
  "HLD", "HNY", "HOC", "HOI",
  "HOL", "HOO", "HOR", "HOX", 
  "HRS", "HSI", "HTS", "HUD", "HUI", "HUK",
  "HVY", "HWA", "HWT", "HWY", "HYD", "HYE",
  "HYP", "IAN", "IAO", "IBA", "IBM", "IBO", "ICH", "ICY", "IDA",
  "IDE", "IDO", "IDS", "IFE", "IFF", "IFS", "IGN", "IHI", "IHP", "IHS",
  "III", "IJO", "IKE", "ILA", "ILE", "IMA", "IMI", 
  "IMU", "INC", "IND", "INF", "ING", "INK", "INN", "INO", "INS", "INT",
  "INV", "IOF", "IOS", "IOU", "IPH", "IPL", "IPM", "IPR", "IPS",
  "IQS", "IRA", "IRS", "ISE", "ISH", "ISL", "ISM", "ISN",
  "ISO", "IST", "ISZ", "ITA", "ITD", "ITO", "ITS", "IUD", "IVA", "IVE",
  "IVY", "IWA", "IYO", "JAD", "JAH", "JAI", "JAK", 
  "JAN", "JAP", "JAR", "JAT", "JAW", "JAY", "JCL", "JCT", "JED", "JEE",
  "JEF", "JEG", "JEM", "JEN", "JER", "JEU", 
  "JIM", "JIN", "JMS", "JND", "JNT", "JOE", "JON", "JOS",
  "JOW", "JUD", "JUN", "JUR", "JUS", "JUV",
  "KAB", "KAE", "KAF", "KAI", "KAJ", "KAL", "KAM", "KAN", "KAS", "KAT",
  "KAW", "KAY", "KEA", "KEB", "KED", "KEE", "KEF", "KEG", "KEN", "KEP",
  "KER", "KET", "KEX", "KEY", "KGF", "KGR", "KHA", "KHI", "KHU", "KID",
  "KIE", "KIF", "KIL", "KIM", "KLN", " KOA", "KOB",
  "KOI", "KOL", "KON", "KOP", "KOR", "KOS", "KOU", "KPC", "KPH", "KRA",
  "KRS", "KRU", "KSI", "KUA", "KUE", "KUI", "KYD", "KYE", "KYL", "KYU",
  "LAC", "LAH", "LAI", "LAK", "LAN", "LAO",
  "LAR", "LAV", "LAZ", "LBF",
  "LBS", "LBW", "LCA", "LCD", "LCM", "LDG", "LEA", "LED", "LEE", "LEG",
  "LEI", "LEK", "LEP", "LER", "LES", "LEV",
  "LEW", "LEX", "LEY", "LHB", "LHD", "LIB", "LIF", "LIG",
  "LIM", "LIN", "LIQ", "LIR", "LIS", "LIV", "LIZ", "LLB",
  "LNR", "LOA", "LOC", "LOD", "LOE", "LOF", 
  "LOQ", "LOR", "LOU", "LOW", "LOX", "LOY", "LPM", "LSC", "LST",
  "LTR", "LUB", "LUC", "LUD", "LUE", "LUG", "LUI", "LUM", "LUO", "LUR",
  "LUT", "LUX", "LWL", "LWM", "LWO", "LWP", "LXX", "LYC", "LYE", "LYM",
  "LYN", "LYS", "MAB", "MAC", "MAE", "MAH", "MAL", 
  "MAO", "MAS", "MAU", 
  "MBD", "MCF", "MCG", "MEA", "MED", "MEE", "MEG", "MEL", "MEM", 
  "MEO", "MEQ", "MER", "MES", "MET", "MEU", "MEV", "MEW", "MFD", "MFG",
  "MFR", "MGD", "MGR", "MGT", "MHG", "MHO", "MHZ", "MIA", "MIB", 
  "MIG", "MIL", "MIM", "MIR", "MIS", "MIT", "MKS", "MKT",
  "MLX", "MMF", "MNA", "MOA", "MOC", "MOD", "MOE", "MOI",
  "MOL", "MON", "MOR", "MOS", "MOT", "MOU", 
  "MOY", "MPB", "MPG", "MPH", "MRS", "MRU", "MSG", "MSL", "MSS", "MTD",
  "MTG", "MTN", "MTS", "MTX", "MUN", "MUS", "MUT",
  "MUX", "MWA", "MXD", "MYA", "MYC", "MYG", "MYM", "NAA", "NAD",
  "NAE", "NAF", "NAG", "NAK", "NAM", "NAN", "NAP", "NAR", "NAT", "NAV",
  "NAW", "NBG", "NCO", "NEA", "NEB", "NED", "NEE", "NEF", "NEG",
  "NEI", "NEK", "NEO", "NEP", "NET", "NEW", "NIB", "NID", "NIG",
  "NIM", "NIS", "NIX", "NOA", "NOB", "NOG", "NOH",
  "NOL", "NOM", "NOO", "NOR", "NOS", "NOU", "NOV", 
  "NOX", "NOY", "NTH", "NUB", "NUL", "NUM", "NUS", "NYE",
  "OAD", "OAM", "OAR", "OBA", "OBB", "OBE", "OBI",
  "OBJ", "OBL", "OBS", "OBV", "OCA", "OCH", "OCK", "OCT", "ODA", 
  "ODS", "ODZ", "OER", "OES", "OFF", "OFO", "OFT", "OHM", "OHO",
  "OHS", "OHV", "OIE", "OII", "OIK", "OIL", "OKA", "OKE", "OKI", "OLA",
  "OLD", "OLE", "OLM", "OLP", "OMS", "ONA", "ONI", "ONO", "ONS",
  "ONT", "ONY", "OOF", "OOH", "OOS", "OOT", "OPA", "OPE", "OPP", "OPS",
  "ORA", "ORC", "ORD", "ORF", "ORG", "ORL", "ORS",
  "ORT", "ORY", "OSC", "OSE", "OSI", "OTC", "OTO", "OUD", "OUF", "OUI",
  "OVA", "OWD", "OWK", "OWT", "OXY",
  "OZS", "PAC", "PAD", "PAH", "PAM", "PAS",
  "PAU", "PAV", "PAX", "PBX", "PCF", "PCI", "PCM",
  "PCT", "PDL", "PDN", "PDQ", "PEA", "PED", "PEH", 
  "PER", "PES", "PFC", "PFD", "PFG", "PFX", "PHI",
  "PHO", "PHR", "PHT", "PHU", "PIA", "PIK", "PIL",
  "PIM", "PIR", "PIS", "PIU", "PIX", "PKG", "PKS",
  "PKT", "PLF", "PLI", "PLU", "PLY", "PMK", "PMT", "POA", "POB", 
  "POE", "POH", "POI", "POL", "POM", "PON",  "POR", "POS", 
"POY", "POZ", "PPA", "PPB", "PPD", "PPH", "PPI", "PPL",
  "PPM", "PPR", "PPS", "PPT", "PRE", "PRF", "PRN", "PRP", "PRS",
  "PSF", "PSI", "PST", "PSW", "PTA", "PTE", "PTG", "PTP", "PTS",
  "PTT", "PTY", "PUA", "PUD", "PUL", 
  "PUY", "PVT", "PWR", "PWT", "PYA", "PYE", "PYR", "PYX",
  "QAF", "QAT", "QED", "QID", "QQV", "QRS", "QTD", "QTO", "QTR", "QTS",
  "QTY", "QUA", "QUE", "QUI", "QUO", "RAB", "RAD", "RAH", "RAJ",
  "RAS", "RAX", "RCD", "RCT",
  "REA", "REB", "REC", "REE", "REH", "REI", "REL",
  "REN", "REP", "REQ", "RES", "RET", "REV", "REW", "REX", "RFB",
  "RFS", "RFZ", "RHA", "RHB", "RHD", "RHE", "RHO", "RIA", "RIC",
  "RIE", "RIK", "RIN", "RIO", "RIT", "RIV",
  "RIX", "RLD", "RLE", "RLY", "RMS", "RND", "ROC", "ROE",
  "ROG", "ROI", "ROK", "ROM", "RON", "ROS", "ROX",
  "ROY", "RPM", "RPS", "RPT", "RTE", "RTI", "RTW", "RUA", "RUD",
  "RUS", "RUX", "RWD", "RWY", "RYA",
  "SAA", "SAC", "SAE", "SAH", "SAI", "SAJ",
  "SAK", "SAL", "SAM", "SAN", "SAO", "SAR", "SAU", "SAV",
  "SCF", "SCH", "SCI", "SCR", "SCT", "SDS", 
  "SEC", "SED", "SEG", "SEI", "SEL", "SEM", "SEN", "SEP", "SEQ",
  "SER", "SEY", "SFM", "SFZ", "SGD", "SHA", 
  "SHI", "SHO", "SHP", "SHR", "SHT", "SHU", "SIA", "SIB",
  "SIC", "SID", "SIE", "SIG", "SIL", "SIM", 
  "SIT", "SIX", "SKI", "SKY", "SLA", "SLD", "SLT", "SMA", "SML",
  "SNY", "SOC", "SOE", "SOH", "SOK", "SOL", 
  "SOS", "SOU", "SOV", "SOX", "SPL",
  "SPP", "SPS", "SPT", "SQD", "SQQ", "SRI", "SSI", "SSP", "SSU",
  "STA", "STD", "STG", "STK", "STM", "STR", "STU", "STY", "SUB", 
  "SUF", "SUI", "SUK", "SUP", "SUQ", "SUR", "SUS",
  "SUU", "SUZ", "SVC", "SWA", "SWY", "SYD", "SYE", "SYL", "SYM", "SYN",
  "SYR", "TAA", "TAE", "TAI", "TAJ", "TAL", "TAM",
  "TAN", "TAO", "TAS", "TAT", "TAU", "TAV", "TAW", 
  "TAY", "TBS", "TCH", "TCK", "TDR", "TEA", "TEC", "TED", "TEE", "TEF",
  "TEG", "TEL", "TEM", "TEN", "TER", "TEW", "TEX", "TEZ", "TFR", "TGN",
  "TGT", "THA", "THO", "TIB", "TIC", "TID", 
  "TIL", "TIM", "TIS", "TIU", "TJI", "TKT", "TLN",
  "TLO", "TLR", "TMH", "TNG", "TNT", "TOA", "TOB", "TOD", 
  "TOI", "TOL", "TOM", "TOR", "TOS", "TOT", "TOU",
  "TOV", "TOX", "TPD", "TPH", "TPI", "TPK", "TPM", "TPS",
  "TRA", "TRF", "TRI", "TRP", "TRS", "TRT", "TSI", "TSK", "TSP",
  "TSS", "TST", "TTY", "TUA", "TUE", "TUI", "TUM", "TUN",
  "TUR", "TUT", "TUY", "TWA", "TWI", "TWP", "TXT",
  "TYE", "TYG", "TYP", "TYR", "TYT", "UBC", "UBI", "UCA", "UDI", "UDO",
  "UDS", "UFO", "UFS", "UGH", "UGT", "UHS", "UIT", "UJI", "UKE", "ULA",
  "ULE", "ULL", "ULT", "ULU", "UME", "UMM", "UMP", "UMU", "UNA", "UNB",
  "UNC", "UNG", "UNI", "UNL", "UNN", "UNP", "UNS", "UPO", "UPS", "URA",
  "URB", "URD", "URE", "URF", "URI", "URN", "URO", "URS", "URU", "USA",
  "USH", "UST", "USU", "USW", "UTA", "UTE", "UTI", "UTS", "UTU",
  "UVA", "VAC", "VAG", "VAI", "VAL", "VAR", "VAS", "VAT", "VAU",
  "VAV", "VAW", "VAX", "VEE", "VEG", "VEI", "VEL", "VER", 
  "VIC", "VIE", "VII", "VIL", "VIN", "VIP", "VIS", "VIZ",
  "VOC", "VOD", "VOE", "VOG", "VOL", "VON", "VOW", "VOX", "VSS", "VUG",
  "VUM", "WAB", "WAC", "WAD", "WAE", "WAF", "WAH", "WAN", "WAP",
  "WAT", "WAW", "WEA", 
  "WEF", "WEI", "WEM", "WEN", "WER", "WES", "WEY", "WHA", "WHF",
  "WHR", "WHS", "WHY", "WID", "WIM", "WIR", "WIS",
  "WJC", "WMK", "WOA", "WOB", "WOD", "WOE", "WOG", "WOK",
  "WON", "WOO", "WOP", "WOS", "WOT", "WOW", "WOY", "WPM", "WRO", "WRY",
  "WUD", "WUN", "WUP", "WUR", "WUS", "WUT", "WYE", "WYN", "XAT", "XCL",
  "XED", "XII", "XIS", "XIV", "XIX", "XVI", "XXI", "XXV", "XXX", "XYZ",
  "YAD", "YAH", "YAN", "YAO", "YAR", "YAS", "YAT",
  "YAW", "YAY", "YDS", "YEA", "YED", "YEE", "YEH",  "YEO", 
  "YER", "YEX", "YEZ", "YID", "YIN", "YIP", "YIS",
  "YOB", "YOD", "YOE", "YOI", "YOK", "YOM", "YON", "YOR", "YOT", 
  "YOW", "YOX", "YOY", "YRS", "YUG", "YUH", "YUK", "YUN", 
  "YUS", "ZAC", "ZAD", "ZAK", "ZAN", "ZAR", "ZAT", "ZAX",
  "ZEA", "ZED", "ZEE", "ZEK", "ZEL", "ZEP", "ZER", "ZHO", 
  "ZOA", "ZOD", 
]);

type LetterCounts = number[];

type Candidate = {
  wordId: number;
  word: string;
  counts: LetterCounts;
  length: number;
  frequencyLevel: string | null;
  hasDefinition: boolean;
};

type BaseWord = {
  id: number;
  word: string;
  length: number;
};

function getLetterCounts(word: string): LetterCounts | null {
  const counts = new Array<number>(26).fill(0);

  for (const character of word.toUpperCase()) {
    const code = character.charCodeAt(0) - 65;
    if (code < 0 || code > 25) return null;
    counts[code] += 1;
  }

  return counts;
}

function isSubset(candidate: LetterCounts, remaining: LetterCounts): boolean {
  for (let index = 0; index < 26; index += 1) {
    if (candidate[index] > remaining[index]) return false;
  }
  return true;
}

function subtractCounts(remaining: LetterCounts, candidate: LetterCounts): LetterCounts {
  return remaining.map((count, index) => count - candidate[index]);
}

function countLetters(counts: LetterCounts): number {
  return counts.reduce((total, count) => total + count, 0);
}

/**
 * Returns component ID combinations in the same order as candidates.
 * Advancing the candidate index prevents permutations of one combination from
 * being emitted separately.
 */
export function* generateExactCombinations(
  baseWord: string,
  candidates: Candidate[],
): Generator<number[]> {
  const baseCounts = getLetterCounts(baseWord);
  if (!baseCounts) return;

  const usableCandidates = candidates
    .filter((candidate) => candidate.length >= 3 && candidate.length < baseWord.length)
    .filter((candidate) => !EXCLUDED_THREE_LETTER_WORDS.has(candidate.word.toUpperCase()))
    .filter((candidate) =>
      candidate.hasDefinition
      || COMMON_FREQUENCY_LEVELS.some((level) => level === candidate.frequencyLevel)
    )
    .filter((candidate) => isSubset(candidate.counts, baseCounts));
  let yieldedCombinations = 0;

  function* search(remaining: LetterCounts, startIndex: number, selected: number[]): Generator<number[]> {
    if (yieldedCombinations >= MAX_COMBINATIONS_PER_BASE_WORD) return;

    const remainingLength = countLetters(remaining);
    if (remainingLength === 0) {
      if (selected.length >= 2) {
        yieldedCombinations += 1;
        yield [...selected];
      }
      return;
    }

    if (remainingLength < 3) return;

    for (let index = startIndex; index < usableCandidates.length; index += 1) {
      const candidate = usableCandidates[index];
      if (!isSubset(candidate.counts, remaining)) continue;

      selected.push(candidate.wordId);
      yield* search(
        subtractCounts(remaining, candidate.counts),
        index + 1,
        selected,
      );
      selected.pop();
      if (yieldedCombinations >= MAX_COMBINATIONS_PER_BASE_WORD) return;
    }
  }

  yield* search(baseCounts, 0, []);
}

async function loadDerivativeCandidates(
  db: any,
  baseWords: BaseWord[],
): Promise<Map<number, Candidate[]>> {
  const candidatesByBase = new Map<number, Candidate[]>();

  for (let offset = 0; offset < baseWords.length; offset += BASE_WORD_BATCH_SIZE) {
    const baseBatch = baseWords.slice(offset, offset + BASE_WORD_BATCH_SIZE);
    const baseIds = baseBatch.map((baseWord) => baseWord.id);
    const derivativeWords = schema.words;

    const rows = await db
      .select({
        baseWordId: schema.wordDerivatives.wordId,
        componentWordId: schema.wordDerivatives.derivativeId,
        componentWord: derivativeWords.word,
        componentLength: derivativeWords.wordLength,
        componentFrequencyLevel: derivativeWords.frequencyLevel,
        componentHasDefinition: exists(
          db
            .select({ wordId: schema.wordDefinitions.wordId })
            .from(schema.wordDefinitions)
            .where(eq(schema.wordDefinitions.wordId, derivativeWords.id)),
        ),
      })
      .from(schema.wordDerivatives)
      .innerJoin(derivativeWords, eq(schema.wordDerivatives.derivativeId, derivativeWords.id))
      .where(and(
        inArray(schema.wordDerivatives.wordId, baseIds),
        gte(derivativeWords.wordLength, 3),
      ))
      .orderBy(asc(schema.wordDerivatives.wordId), asc(schema.wordDerivatives.derivativeId));

    for (const row of rows) {
      const counts = getLetterCounts(row.componentWord);
      if (!counts || counts.length === 0) continue;

      const list = candidatesByBase.get(row.baseWordId) ?? [];
      list.push({
        wordId: row.componentWordId,
        word: row.componentWord,
        counts,
        length: row.componentLength,
        frequencyLevel: row.componentFrequencyLevel,
        hasDefinition: Boolean(row.componentHasDefinition),
      });
      candidatesByBase.set(row.baseWordId, list);
    }

    console.log(
      `  Loaded derivatives for base words ${offset + 1}–${offset + baseBatch.length}`,
    );
  }

  return candidatesByBase;
}

type GenerationStats = {
  baseWords: number;
  basesWithCombinations: number;
  combinations: number;
  componentRows: number;
  maxCombinationsForBase: number;
  maxCombinationsWord: string | null;
};

type ComponentRow = {
  wordId: number;
  combinationId: number;
  componentWordId: number;
};

async function generateAndStore(
  db: any,
  baseWords: BaseWord[],
  dryRun: boolean,
): Promise<GenerationStats> {
  const stats: GenerationStats = {
    baseWords: baseWords.length,
    basesWithCombinations: 0,
    combinations: 0,
    componentRows: 0,
    maxCombinationsForBase: 0,
    maxCombinationsWord: null,
  };
  const insertBuffer: ComponentRow[] = [];
  let nextCombinationId = 1;

  const process = async (database: any) => {
    if (!dryRun) {
      await database.delete(schema.wordAssemblyComponents);
    }

    for (let offset = 0; offset < baseWords.length; offset += BASE_WORD_BATCH_SIZE) {
      const baseBatch = baseWords.slice(offset, offset + BASE_WORD_BATCH_SIZE);
      const candidatesByBase = await loadDerivativeCandidates(database, baseBatch);

      for (const baseWord of baseBatch) {
        const candidates = (candidatesByBase.get(baseWord.id) ?? [])
          .filter((candidate) => candidate.wordId !== baseWord.id)
          .sort((left, right) => left.wordId - right.wordId);
        let baseCombinationCount = 0;

        for (const combination of generateExactCombinations(baseWord.word, candidates)) {
          const currentCombinationId = nextCombinationId;
          nextCombinationId += 1;
          baseCombinationCount += 1;
          stats.combinations += 1;
          stats.componentRows += combination.length;

          if (!dryRun) {
            for (const componentWordId of combination) {
              insertBuffer.push({
                wordId: baseWord.id,
                combinationId: currentCombinationId,
                componentWordId,
              });
            }

            if (insertBuffer.length >= INSERT_BATCH_SIZE) {
              await database
                .insert(schema.wordAssemblyComponents)
                .values(insertBuffer.splice(0));
            }
          }
        }

        if (baseCombinationCount > 0) {
          stats.basesWithCombinations += 1;
          if (baseCombinationCount > stats.maxCombinationsForBase) {
            stats.maxCombinationsForBase = baseCombinationCount;
            stats.maxCombinationsWord = baseWord.word;
          }
          console.log(
            `  ${baseWord.word}: ${baseCombinationCount} combination${baseCombinationCount === 1 ? "" : "s"}`,
          );
        }
      }

      candidatesByBase.clear();
      console.log(
        `  Processed base words ${offset + 1}–${offset + baseBatch.length} / ${baseWords.length}`,
      );
    }

    if (!dryRun && insertBuffer.length > 0) {
      await database
        .insert(schema.wordAssemblyComponents)
        .values(insertBuffer.splice(0));
    }
  };

  if (dryRun) {
    await process(db);
  } else {
    await db.transaction(process);
  }

  return stats;
}

async function main() {
  const connection = await mysql.createConnection(getMySQLConnectionConfig());
  const db = drizzle(connection, { schema, mode: "default" });
  const dryRun = process.argv.includes("--dry-run");

  try {
    console.log(
      `Connected to database. Loading eligible base words${dryRun ? " (dry run)" : ""}...`,
    );

    const baseRows = await db
      .select({
        id: schema.words.id,
        word: schema.words.word,
        wordLength: schema.words.wordLength,
      })
      .from(schema.words)
      .where(and(
        eq(schema.words.isWordSplit, true),
        gte(schema.words.wordLength, 6),
        inArray(schema.words.frequencyLevel, [...COMMON_FREQUENCY_LEVELS]),
      ))
      .orderBy(asc(schema.words.id));

    const baseWords: BaseWord[] = baseRows
      .map((row) => ({ id: row.id, word: row.word, length: row.wordLength }))
      .filter((baseWord) => {
        const counts = getLetterCounts(baseWord.word);
        return counts !== null && counts.length > 0;
      });

    console.log(`Found ${baseWords.length} eligible base words.`);
    const stats = await generateAndStore(db, baseWords, dryRun);

    console.log(
      `Generated ${stats.combinations} combinations across ${stats.basesWithCombinations} base words (${stats.componentRows} component rows).`,
    );
    if (stats.maxCombinationsWord) {
      console.log(
        `Largest base word: ${stats.maxCombinationsWord} (${stats.maxCombinationsForBase} combinations).`,
      );
    }
    console.log(
      dryRun
        ? "Dry run complete. No database rows were changed."
        : "Replaced word_assembly_components successfully.",
    );
  } finally {
    await connection.end();
  }
}

const invokedScriptName = process.argv[1]?.split(/[\\/]/).pop();

if (invokedScriptName === "populate-word-assembly-combinations.ts") {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}