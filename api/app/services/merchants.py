"""Seed merchant list and descriptor normalisation.

The list is deliberately data, not code: it is the cheapest way to get high
categorisation accuracy on Indian statements, and it is meant to be extended.
Keys are canonical names; values are (category name, aliases that appear in bank
narrations).
"""

from __future__ import annotations

import re

# canonical: (category, [aliases found in statements])
MERCHANTS: dict[str, tuple[str, tuple[str, ...]]] = {
    # food delivery and dining
    "Swiggy": ("Dining", ("SWIGGY", "SWIGGYINSTAMART", "BUNDL")),
    "Zomato": ("Dining", ("ZOMATO", "ETERNAL")),
    "Domino's": ("Dining", ("DOMINOS", "JUBILANT FOOD")),
    "McDonald's": ("Dining", ("MCDONALD", "MCDONALDS")),
    "KFC": ("Dining", ("KFC", "YUM RESTAURANT")),
    "Burger King": ("Dining", ("BURGER KING",)),
    "Starbucks": ("Coffee", ("STARBUCKS", "TATA STARBUCKS")),
    "Third Wave Coffee": ("Coffee", ("THIRD WAVE", "THIRDWAVE")),
    "Blue Tokai": ("Coffee", ("BLUE TOKAI",)),
    "Chaayos": ("Coffee", ("CHAAYOS",)),
    "Cafe Coffee Day": ("Coffee", ("CCD", "COFFEE DAY")),
    "Barbeque Nation": ("Dining", ("BARBEQUE NATION", "BARBECUE NATION")),
    "Haldiram's": ("Dining", ("HALDIRAM",)),
    # groceries and quick commerce
    "Blinkit": ("Groceries", ("BLINKIT", "GROFERS")),
    "Zepto": ("Groceries", ("ZEPTO", "KIRANAKART")),
    "BigBasket": ("Groceries", ("BIGBASKET", "INNOVATIVE RETAIL")),
    "DMart": ("Groceries", ("DMART", "AVENUE SUPERMARTS")),
    "JioMart": ("Groceries", ("JIOMART", "RELIANCE RETAIL")),
    "Instamart": ("Groceries", ("INSTAMART",)),
    "More Supermarket": ("Groceries", ("MORE MEGASTORE", "MORE RETAIL")),
    "Reliance Fresh": ("Groceries", ("RELIANCE FRESH",)),
    "Spencer's": ("Groceries", ("SPENCERS",)),
    "Nature's Basket": ("Groceries", ("NATURES BASKET",)),
    "Licious": ("Groceries", ("LICIOUS", "DELIGHTFUL GOURMET")),
    "Country Delight": ("Groceries", ("COUNTRY DELIGHT",)),
    # transport
    "Uber": ("Cab", ("UBER",)),
    "Ola": ("Cab", ("OLA CABS", "ANI TECHNOLOGIES", "OLA ELECTRIC")),
    "Rapido": ("Cab", ("RAPIDO", "ROPPEN")),
    "BluSmart": ("Cab", ("BLUSMART",)),
    "Namma Metro": ("Metro", ("NMMA", "BMRCL", "METRO RAIL")),
    "DMRC": ("Metro", ("DMRC", "DELHI METRO")),
    "IRCTC": ("Train", ("IRCTC", "INDIAN RAILWAY")),
    "RedBus": ("Train", ("REDBUS", "IBIBO")),
    "Indian Oil": ("Fuel", ("INDIAN OIL", "IOCL")),
    "HP Petrol Pump": ("Fuel", ("HPCL", "HINDUSTAN PETROLEUM")),
    "Bharat Petroleum": ("Fuel", ("BPCL", "BHARAT PETROLEUM")),
    "Shell": ("Fuel", ("SHELL",)),
    "Fastag": ("Fuel", ("FASTAG", "NETC")),
    # housing and utilities
    "Rent": ("Rent", ("RENT", "LANDLORD", "HOUSE RENT")),
    "BESCOM": ("Electricity", ("BESCOM", "BANGALORE ELECTRICITY")),
    "Tata Power": ("Electricity", ("TATA POWER", "TPCODL")),
    "Adani Electricity": ("Electricity", ("ADANI ELECTRICITY",)),
    "MSEDCL": ("Electricity", ("MSEDCL", "MAHADISCOM")),
    "BSES": ("Electricity", ("BSES",)),
    "Jio": ("Internet", ("JIO", "RELIANCE JIO", "JIOFIBER")),
    "Airtel": ("Internet", ("AIRTEL", "BHARTI AIRTEL")),
    "Vi": ("Internet", ("VODAFONE IDEA", "VODAFONE", " IDEA ") ),
    "ACT Fibernet": ("Internet", ("ACT FIBERNET", "ATRIA CONVERGENCE")),
    "Hathway": ("Internet", ("HATHWAY",)),
    "Urban Company": ("Maintenance", ("URBAN COMPANY", "URBANCLAP")),
    "NoBroker": ("Maintenance", ("NOBROKER",)),
    # shopping
    "Amazon": ("Electronics", ("AMAZON", "AMZN")),
    "Flipkart": ("Electronics", ("FLIPKART",)),
    "Croma": ("Electronics", ("CROMA", "TATA CROMA")),
    "Reliance Digital": ("Electronics", ("RELIANCE DIGITAL",)),
    "Vijay Sales": ("Electronics", ("VIJAY SALES",)),
    "Apple": ("Electronics", ("APPLE INDIA", "APPLE STORE")),
    "Myntra": ("Clothing", ("MYNTRA",)),
    "Ajio": ("Clothing", ("AJIO", "RELIANCE FASHION")),
    "Nykaa": ("Clothing", ("NYKAA", "FSL")),
    "H&M": ("Clothing", ("H AND M", "H&M")),
    "Zara": ("Clothing", ("ZARA", "INDITEX")),
    "Decathlon": ("Clothing", ("DECATHLON",)),
    "IKEA": ("Home", ("IKEA",)),
    "Pepperfry": ("Home", ("PEPPERFRY",)),
    "Urban Ladder": ("Home", ("URBAN LADDER",)),
    "Home Centre": ("Home", ("HOME CENTRE", "LANDMARK GROUP")),
    # health
    "Apollo Pharmacy": ("Pharmacy", ("APOLLO PHARMACY", "APOLLO PHARMA")),
    "MedPlus": ("Pharmacy", ("MEDPLUS",)),
    "PharmEasy": ("Pharmacy", ("PHARMEASY", "API HOLDINGS")),
    "1mg": ("Pharmacy", ("TATA 1MG", "1MG")),
    "Netmeds": ("Pharmacy", ("NETMEDS",)),
    "Practo": ("Doctor", ("PRACTO",)),
    "Apollo Hospital": ("Doctor", ("APOLLO HOSPITAL",)),
    "Cult.fit": ("Fitness", ("CULT FIT", "CUREFIT", "CULTFIT")),
    "Gold's Gym": ("Fitness", ("GOLDS GYM",)),
    "AnyTime Fitness": ("Fitness", ("ANYTIME FITNESS",)),
    # subscriptions and entertainment
    "Netflix": ("Subscriptions", ("NETFLIX",)),
    "Hotstar": ("Subscriptions", ("HOTSTAR", "STAR INDIA")),
    "Prime Video": ("Subscriptions", ("PRIME VIDEO", "AMAZON PRIME")),
    "Spotify": ("Subscriptions", ("SPOTIFY",)),
    "YouTube Premium": ("Subscriptions", ("YOUTUBE", "GOOGLE INDIA DIGITAL")),
    "Google One": ("Subscriptions", ("GOOGLE ONE", "GOOGLE STORAGE")),
    "Apple iCloud": ("Subscriptions", ("ICLOUD", "APPLE MEDIA")),
    "Audible": ("Subscriptions", ("AUDIBLE",)),
    "BookMyShow": ("Movies", ("BOOKMYSHOW", "BIGTREE")),
    "PVR": ("Movies", ("PVR", "PVRINOX")),
    "INOX": ("Movies", ("INOX",)),
    "Zomato Live": ("Events", ("ZOMATO LIVE",)),
    "District": ("Events", ("DISTRICT", "ZOMATO DISTRICT")),
    # money and finance
    "Zerodha": ("Fees", ("ZERODHA",)),
    "Groww": ("Fees", ("GROWW", "NEXTBILLION")),
    "LIC": ("Insurance", ("LIC OF INDIA", "LIFE INSURANCE CORP")),
    "HDFC Life": ("Insurance", ("HDFC LIFE",)),
    "ICICI Prudential": ("Insurance", ("ICICI PRUDENTIAL", "ICICI PRU")),
    "Policybazaar": ("Insurance", ("POLICYBAZAAR",)),
    "Acko": ("Insurance", ("ACKO",)),
    "Bank Charges": ("Fees", ("SMS CHARGES", "ANNUAL FEE", "AMB CHARGES", "SERVICE CHARGE", "GST ON")),
    "Interest": ("Interest", ("INTEREST CREDIT", "INT.PD", "INTEREST PAID")),
    # income
    "Salary": ("Salary", ("SALARY", "SAL CR", "SALARY CREDIT")),
    "Freelance": ("Freelance", ("FREELANCE", "CONSULTANCY", "PROFESSIONAL FEE")),
    "Refund": ("Refund", ("REFUND", "REVERSAL", "CHARGEBACK")),
}

_NOISE = re.compile(
    r"\b(UPI|IMPS|NEFT|RTGS|POS|ACH|NACH|MMT|DR|CR|TXN|TRANSFER|PAYMENT|PAY|TO|FROM|REF|NO|ID|"
    r"BANGALORE|BENGALURU|MUMBAI|DELHI|GURGAON|NOIDA|PUNE|HYDERABAD|CHENNAI|KOLKATA|INDIA|LTD|PVT|"
    r"PRIVATE|LIMITED|TECHNOLOGIES|SERVICES)\b",
    re.IGNORECASE,
)


def normalise(description: str) -> str:
    """Reduce a bank narration to something comparable: no noise, no digits."""
    text = re.sub(r"[^A-Za-z0-9&.\s]", " ", description.upper())
    text = re.sub(r"\d{3,}", " ", text)          # reference numbers
    text = _NOISE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


_ALIASES: list[tuple[str, str, str]] = sorted(
    (
        (alias.upper(), canonical, category)
        for canonical, (category, aliases) in MERCHANTS.items()
        for alias in aliases
    ),
    key=lambda row: len(row[0]),
    reverse=True,  # longest alias wins, so "APOLLO PHARMACY" beats "APOLLO HOSPITAL"
)


def match(description: str) -> tuple[str | None, str | None]:
    """Return (canonical merchant, category name) or (None, None)."""
    haystack = f" {description.upper()} "
    for alias, canonical, category in _ALIASES:
        if alias in haystack:
            return canonical, category
    return None, None
