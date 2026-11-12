/** Compact seed list for the demo transport. The API carries the full list. */

type Seed = [canonical: string, category: string, ...aliases: string[]];

const SEEDS: Seed[] = [
  ["Swiggy", "Dining", "SWIGGY"],
  ["Zomato", "Dining", "ZOMATO"],
  ["Starbucks", "Coffee", "STARBUCKS"],
  ["Third Wave Coffee", "Coffee", "THIRD WAVE"],
  ["Blue Tokai", "Coffee", "BLUE TOKAI"],
  ["Blinkit", "Groceries", "BLINKIT"],
  ["Zepto", "Groceries", "ZEPTO"],
  ["BigBasket", "Groceries", "BIGBASKET"],
  ["DMart", "Groceries", "DMART"],
  ["JioMart", "Groceries", "JIOMART"],
  ["Uber", "Cab", "UBER"],
  ["Ola", "Cab", "OLA CABS", "ANI TECHNOLOGIES"],
  ["Rapido", "Cab", "RAPIDO"],
  ["IRCTC", "Train", "IRCTC"],
  ["Namma Metro", "Metro", "BMRCL", "NMMA"],
  ["Indian Oil", "Fuel", "INDIAN OIL", "IOCL"],
  ["HP Petrol Pump", "Fuel", "HPCL"],
  ["Bharat Petroleum", "Fuel", "BPCL"],
  ["Rent", "Rent", "RENT", "LANDLORD"],
  ["BESCOM", "Electricity", "BESCOM"],
  ["Tata Power", "Electricity", "TATA POWER"],
  ["Jio", "Internet", "JIO"],
  ["Airtel", "Internet", "AIRTEL"],
  ["ACT Fibernet", "Internet", "ACT FIBERNET"],
  ["Urban Company", "Maintenance", "URBAN COMPANY"],
  ["Amazon", "Electronics", "AMAZON"],
  ["Flipkart", "Electronics", "FLIPKART"],
  ["Croma", "Electronics", "CROMA"],
  ["Myntra", "Clothing", "MYNTRA"],
  ["Ajio", "Clothing", "AJIO"],
  ["Nykaa", "Clothing", "NYKAA"],
  ["IKEA", "Home", "IKEA"],
  ["Apollo Pharmacy", "Pharmacy", "APOLLO PHARMACY"],
  ["MedPlus", "Pharmacy", "MEDPLUS"],
  ["PharmEasy", "Pharmacy", "PHARMEASY"],
  ["1mg", "Pharmacy", "1MG"],
  ["Cult.fit", "Fitness", "CULT FIT", "CUREFIT"],
  ["Netflix", "Subscriptions", "NETFLIX"],
  ["Hotstar", "Subscriptions", "HOTSTAR"],
  ["Spotify", "Subscriptions", "SPOTIFY"],
  ["Prime Video", "Subscriptions", "PRIME VIDEO"],
  ["BookMyShow", "Movies", "BOOKMYSHOW"],
  ["PVR", "Movies", "PVR"],
  ["LIC", "Insurance", "LIC OF INDIA"],
  ["Policybazaar", "Insurance", "POLICYBAZAAR"],
  ["Bank Charges", "Fees", "SMS CHARGES", "ANNUAL FEE", "SERVICE CHARGE"],
  ["Interest", "Interest", "INTEREST CREDIT"],
  ["Salary", "Salary", "SALARY"],
  ["Freelance", "Freelance", "FREELANCE", "CONSULTANCY"],
  ["Refund", "Refund", "REFUND", "REVERSAL"],
];

const NOISE =
  /\b(UPI|IMPS|NEFT|RTGS|POS|ACH|NACH|MMT|DR|CR|TXN|TRANSFER|PAYMENT|PAY|TO|FROM|REF|NO|ID|BANGALORE|BENGALURU|MUMBAI|DELHI|GURGAON|NOIDA|PUNE|HYDERABAD|CHENNAI|KOLKATA|INDIA|LTD|PVT|PRIVATE|LIMITED|TECHNOLOGIES|SERVICES)\b/gi;

export function normaliseMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z0-9&.\s]/g, " ")
    .replace(/\d{3,}/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = SEEDS.flatMap(([canonical, category, ...aliases]) =>
  aliases.map((alias) => ({ alias: alias.toUpperCase(), canonical, category })),
).sort((a, b) => b.alias.length - a.alias.length);

export function matchMerchant(description: string): { merchant: string; category: string | null } {
  const haystack = ` ${description.toUpperCase()} `;
  for (const { alias, canonical, category } of ALIASES) {
    if (haystack.includes(alias)) return { merchant: canonical, category };
  }
  return { merchant: normaliseMerchant(description) || description.slice(0, 60), category: null };
}
