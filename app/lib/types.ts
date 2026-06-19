// Core domain types for the property-opportunity scanner.
//
// A `Listing` is the normalized shape we expect from any source (Zillow,
// Redfin, an MLS feed, a scraper, or — for now — local mock data). Keeping
// every source mapped to this one shape means the scoring engine never has to
// care where a property came from.

export type ListingSource = "zillow" | "redfin" | "realtor" | "mls" | "mock";

export type PropertyType =
  | "single-family"
  | "condo"
  | "townhouse"
  | "multi-family"
  | "land";

/** A signal that a seller may be motivated / the deal may be distressed. */
export type DistressFlag =
  | "foreclosure"
  | "short-sale"
  | "auction"
  | "estate-sale"
  | "fixer-upper"
  | "price-reduced";

export interface PriceChange {
  /** ISO date of the change. */
  date: string;
  /** Price after the change, in dollars. */
  price: number;
}

export interface Listing {
  id: string;
  source: ListingSource;
  /** Link back to the original listing, when available. */
  url?: string;

  // Location
  address: string;
  city: string;
  state: string;
  zip: string;

  // Physical
  propertyType: PropertyType;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSqft?: number;

  // Pricing
  /** Current list price, in dollars. */
  listPrice: number;
  /**
   * Independent estimate of fair market value (Zestimate / Redfin Estimate /
   * comp-based AVM), in dollars. The gap between this and `listPrice` is the
   * core "below market" signal.
   */
  estimatedValue: number;
  priceHistory: PriceChange[];
  daysOnMarket: number;

  // Rental / income
  /** Estimated achievable monthly market rent, in dollars. */
  estimatedRent: number;
  /** Monthly HOA dues, in dollars. */
  hoaMonthly: number;
  /** Annual property tax, in dollars. */
  propertyTaxAnnual: number;
  /** Annual homeowner's insurance, in dollars. */
  insuranceAnnual: number;

  // Market context
  /** Trailing 12-month home-price appreciation for the ZIP/metro, as a ratio (0.05 = +5%). */
  marketAppreciationYoY: number;
  /** Median days-on-market for the local market — context for this listing's DOM. */
  marketMedianDaysOnMarket: number;

  distressFlags: DistressFlag[];

  imageColor: string; // placeholder visual until real photos are wired in
  listedDate: string;
}
