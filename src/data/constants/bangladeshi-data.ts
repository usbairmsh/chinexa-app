export const DIVISIONS = [
  "Dhaka",
  "Chittagong",
  "Rajshahi",
  "Khulna",
  "Barisal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
] as const;

export const DISTRICTS: Record<string, string[]> = {
  Dhaka: ["Dhaka", "Gazipur", "Narayanganj", "Tangail", "Manikganj", "Munshiganj", "Narsingdi", "Faridpur"],
  Chittagong: ["Chittagong", "Cox's Bazar", "Comilla", "Feni", "Noakhali", "Lakshmipur", "Rangamati"],
  Rajshahi: ["Rajshahi", "Bogra", "Pabna", "Natore", "Naogaon", "Chapainawabganj"],
  Khulna: ["Khulna", "Jessore", "Satkhira", "Bagerhat", "Kushtia", "Meherpur"],
  Barisal: ["Barisal", "Patuakhali", "Bhola", "Jhalokathi", "Pirojpur"],
  Sylhet: ["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"],
  Rangpur: ["Rangpur", "Dinajpur", "Thakurgaon", "Panchagarh", "Kurigram"],
  Mymensingh: ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
};

export const FEMALE_NAMES = [
  "Fatima Akter", "Ayesha Rahman", "Nusrat Jahan", "Tasnim Ahmed",
  "Sadia Islam", "Maliha Khan", "Rima Sultana", "Nadia Hossain",
  "Tamanna Akter", "Jannatul Ferdous", "Priya Das", "Nabila Chowdhury",
  "Sabrina Islam", "Meher Afroz", "Farzana Yasmin", "Laboni Akter",
  "Sumaiya Rahman", "Tasneem Haque", "Anika Tasnim", "Fariha Noor",
  "Sharmin Sultana", "Nusaiba Ahmed", "Raisa Islam", "Mahfuza Begum",
  "Tabassum Nahar", "Zarin Tasnim", "Samiha Khan", "Lamia Akter",
  "Afrin Sultana", "Ishrat Jahan", "Rina Begum", "Shirina Akter",
  "Parveen Sultana", "Nasreen Akter", "Salma Begum", "Rehana Parvin",
  "Umme Habiba", "Khadija Akter", "Mariam Begum", "Hasina Begum",
  "Shahnaz Parvin", "Rokeya Begum", "Josna Akter", "Moushumi Rahman",
  "Shapla Begum", "Lovely Akter", "Beauty Akter", "Moon Akter",
  "Lucky Begum", "Happy Akter",
];

export const AREAS = [
  "Gulshan", "Banani", "Dhanmondi", "Uttara", "Mirpur", "Mohammadpur",
  "Bashundhara", "Baridhara", "Lalmatia", "Motijheel", "Wari", "Tejgaon",
  "Farmgate", "Shahbag", "Paltan", "Kakrail", "Ramna", "Eskaton",
  "Green Road", "Elephant Road", "New Market", "Azimpur",
  "Agrabad", "Nasirabad", "Khulshi", "Halishahar", "GEC Circle",
  "Rajshahi City", "Sylhet City", "Khulna City", "Barisal City",
];

export const STREET_NAMES = [
  "Road No. 1", "Road No. 5", "Road No. 11", "Road No. 27",
  "Main Road", "Lake Road", "Park Road", "Station Road",
  "College Road", "Hospital Road", "Market Road", "School Road",
];

export const PHONE_PREFIXES = [
  "013", "014", "015", "016", "017", "018", "019",
];
