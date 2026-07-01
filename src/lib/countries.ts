export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", flag: "\u{1F1E6}\u{1F1EB}" },
  { code: "AL", name: "Albania", flag: "\u{1F1E6}\u{1F1F1}" },
  { code: "DZ", name: "Algeria", flag: "\u{1F1E9}\u{1F1FF}" },
  { code: "AR", name: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  { code: "AU", name: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "AT", name: "Austria", flag: "\u{1F1E6}\u{1F1F9}" },
  { code: "BD", name: "Bangladesh", flag: "\u{1F1E7}\u{1F1E9}" },
  { code: "BE", name: "Belgium", flag: "\u{1F1E7}\u{1F1EA}" },
  { code: "BR", name: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "BN", name: "Brunei", flag: "\u{1F1E7}\u{1F1F3}" },
  { code: "KH", name: "Cambodia", flag: "\u{1F1F0}\u{1F1ED}" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "CL", name: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  { code: "CN", name: "China", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "CO", name: "Colombia", flag: "\u{1F1E8}\u{1F1F4}" },
  { code: "HR", name: "Croatia", flag: "\u{1F1ED}\u{1F1F7}" },
  { code: "CZ", name: "Czech Republic", flag: "\u{1F1E8}\u{1F1FF}" },
  { code: "DK", name: "Denmark", flag: "\u{1F1E9}\u{1F1F0}" },
  { code: "EG", name: "Egypt", flag: "\u{1F1EA}\u{1F1EC}" },
  { code: "FI", name: "Finland", flag: "\u{1F1EB}\u{1F1EE}" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "GR", name: "Greece", flag: "\u{1F1EC}\u{1F1F7}" },
  { code: "HK", name: "Hong Kong", flag: "\u{1F1ED}\u{1F1F0}" },
  { code: "HU", name: "Hungary", flag: "\u{1F1ED}\u{1F1FA}" },
  { code: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "ID", name: "Indonesia", flag: "\u{1F1EE}\u{1F1E9}" },
  { code: "IR", name: "Iran", flag: "\u{1F1EE}\u{1F1F7}" },
  { code: "IQ", name: "Iraq", flag: "\u{1F1EE}\u{1F1F6}" },
  { code: "IE", name: "Ireland", flag: "\u{1F1EE}\u{1F1EA}" },
  { code: "IL", name: "Israel", flag: "\u{1F1EE}\u{1F1F1}" },
  { code: "IT", name: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "JO", name: "Jordan", flag: "\u{1F1EF}\u{1F1F4}" },
  { code: "KZ", name: "Kazakhstan", flag: "\u{1F1F0}\u{1F1FF}" },
  { code: "KE", name: "Kenya", flag: "\u{1F1F0}\u{1F1EA}" },
  { code: "KR", name: "South Korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "KW", name: "Kuwait", flag: "\u{1F1F0}\u{1F1FC}" },
  { code: "LA", name: "Laos", flag: "\u{1F1F1}\u{1F1E6}" },
  { code: "LB", name: "Lebanon", flag: "\u{1F1F1}\u{1F1E7}" },
  { code: "MY", name: "Malaysia", flag: "\u{1F1F2}\u{1F1FE}" },
  { code: "MV", name: "Maldives", flag: "\u{1F1F2}\u{1F1FB}" },
  { code: "MX", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "MA", name: "Morocco", flag: "\u{1F1F2}\u{1F1E6}" },
  { code: "MM", name: "Myanmar", flag: "\u{1F1F2}\u{1F1F2}" },
  { code: "NP", name: "Nepal", flag: "\u{1F1F3}\u{1F1F5}" },
  { code: "NL", name: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "NZ", name: "New Zealand", flag: "\u{1F1F3}\u{1F1FF}" },
  { code: "NG", name: "Nigeria", flag: "\u{1F1F3}\u{1F1EC}" },
  { code: "KP", name: "North Korea", flag: "\u{1F1F0}\u{1F1F5}" },
  { code: "NO", name: "Norway", flag: "\u{1F1F3}\u{1F1F4}" },
  { code: "OM", name: "Oman", flag: "\u{1F1F4}\u{1F1F2}" },
  { code: "PK", name: "Pakistan", flag: "\u{1F1F5}\u{1F1F0}" },
  { code: "PS", name: "Palestine", flag: "\u{1F1F5}\u{1F1F8}" },
  { code: "PE", name: "Peru", flag: "\u{1F1F5}\u{1F1EA}" },
  { code: "PH", name: "Philippines", flag: "\u{1F1F5}\u{1F1ED}" },
  { code: "PL", name: "Poland", flag: "\u{1F1F5}\u{1F1F1}" },
  { code: "PT", name: "Portugal", flag: "\u{1F1F5}\u{1F1F9}" },
  { code: "QA", name: "Qatar", flag: "\u{1F1F6}\u{1F1E6}" },
  { code: "RO", name: "Romania", flag: "\u{1F1F7}\u{1F1F4}" },
  { code: "RU", name: "Russia", flag: "\u{1F1F7}\u{1F1FA}" },
  { code: "SA", name: "Saudi Arabia", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "SG", name: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  { code: "ZA", name: "South Africa", flag: "\u{1F1FF}\u{1F1E6}" },
  { code: "ES", name: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "LK", name: "Sri Lanka", flag: "\u{1F1F1}\u{1F1F0}" },
  { code: "SE", name: "Sweden", flag: "\u{1F1F8}\u{1F1EA}" },
  { code: "CH", name: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}" },
  { code: "TW", name: "Taiwan", flag: "\u{1F1F9}\u{1F1FC}" },
  { code: "TH", name: "Thailand", flag: "\u{1F1F9}\u{1F1ED}" },
  { code: "TR", name: "Turkey", flag: "\u{1F1F9}\u{1F1F7}" },
  { code: "AE", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
  { code: "GB", name: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "UA", name: "Ukraine", flag: "\u{1F1FA}\u{1F1E6}" },
  { code: "US", name: "USA", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "UZ", name: "Uzbekistan", flag: "\u{1F1FA}\u{1F1FF}" },
  { code: "VN", name: "Vietnam", flag: "\u{1F1FB}\u{1F1F3}" },
  { code: "YE", name: "Yemen", flag: "\u{1F1FE}\u{1F1EA}" },
];

/** Get flag emoji for a country name (fuzzy match) */
export function getCountryFlag(name: string | null | undefined): string {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  const match = COUNTRIES.find(
    (c) => c.name.toLowerCase() === lower || c.code.toLowerCase() === lower
  );
  // Handle common aliases
  if (!match) {
    if (lower === "korea" || lower === "south korea") return "\u{1F1F0}\u{1F1F7}";
    if (lower === "uk" || lower === "united kingdom" || lower === "england") return "\u{1F1EC}\u{1F1E7}";
    if (lower === "usa" || lower === "united states" || lower === "america") return "\u{1F1FA}\u{1F1F8}";
    if (lower === "uae" || lower === "united arab emirates") return "\u{1F1E6}\u{1F1EA}";
  }
  return match?.flag || "";
}
