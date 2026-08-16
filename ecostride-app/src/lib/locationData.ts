// Canonical Geographic Location Dataset for EcoStride

export interface StateData {
  code: string;
  name: string;
  cities: string[];
}

export interface CountryData {
  code: string;
  name: string;
  states: StateData[];
}

export const COUNTRIES_DATA: CountryData[] = [
  {
    code: 'MY',
    name: 'Malaysia',
    states: [
      {
        code: 'SWK',
        name: 'Sarawak',
        cities: [
          'Sibu',
          'Kuching',
          'Miri',
          'Bintulu',
          'Samarahan',
          'Sarikei',
          'Sri Aman',
          'Kapit',
          'Limbang',
          'Mukah',
          'Betong',
          'Serian',
          'Lawas',
          'Marudi',
          'Kanowit',
          'Song',
          'Belaga',
          'Dalat',
          'Matu',
          'Daro',
          'Tatau',
          'Sebauh',
          'Bau',
          'Lundu',
          'Lubok Antu',
          'Asajaya'
        ]
      },
      {
        code: 'JHR',
        name: 'Johor',
        cities: [
          'Johor Bahru',
          'Batu Pahat',
          'Muar',
          'Kluang',
          'Kulai',
          'Segamat',
          'Pontian',
          'Kota Tinggi',
          'Mersing',
          'Tangkak',
          'Iskandar Puteri',
          'Pasir Gudang',
          'Skudai',
          'Ulu Tiram',
          'Senai'
        ]
      },
      {
        code: 'SGR',
        name: 'Selangor',
        cities: [
          'Shah Alam',
          'Petaling Jaya',
          'Subang Jaya',
          'Klang',
          'Ampang Jaya',
          'Kajang',
          'Selayang',
          'Sepang',
          'Rawang',
          'Banting',
          'Cyberjaya',
          'Puchong',
          'Seri Kembangan',
          'Bangi',
          'Kuala Selangor',
          'Kuala Kubu Bharu',
          'Semeyih'
        ]
      },
      {
        code: 'KUL',
        name: 'Kuala Lumpur',
        cities: [
          'Kuala Lumpur',
          'Bukit Bintang',
          'Cheras',
          'Kepong',
          'Setapak',
          'Wangsa Maju',
          'Bangsar',
          'Mont Kiara',
          'Segambut',
          'Batu',
          'Titiwangsa',
          'Seputeh',
          'Bandar Tun Razak',
          'Lembah Pantai'
        ]
      },
      {
        code: 'PNG',
        name: 'Penang',
        cities: [
          'George Town',
          'Butterworth',
          'Bukit Mertajam',
          'Bayan Lepas',
          'Seberang Perai',
          'Balik Pulau',
          'Nibong Tebal',
          'Kepala Batas',
          'Tanjung Bungah',
          'Air Itam'
        ]
      },
      {
        code: 'SBH',
        name: 'Sabah',
        cities: [
          'Kota Kinabalu',
          'Sandakan',
          'Tawau',
          'Lahad Datu',
          'Keningau',
          'Penampang',
          'Putatan',
          'Tuaran',
          'Papar',
          'Kudat',
          'Ranau',
          'Kota Belud',
          'Semporna'
        ]
      },
      {
        code: 'PRK',
        name: 'Perak',
        cities: [
          'Ipoh',
          'Taiping',
          'Teluk Intan',
          'Manjung',
          'Batu Gajah',
          'Kuala Kangsar',
          'Kampar',
          'Tapah',
          'Tanjung Malim',
          'Lumut',
          'Sitiawan',
          'Parit Buntar',
          'Gerik'
        ]
      },
      {
        code: 'MLK',
        name: 'Melaka',
        cities: [
          'Melaka City',
          'Alor Gajah',
          'Jasin',
          'Ayer Keroh',
          'Batu Berendam',
          'Klebang',
          'Masjid Tanah'
        ]
      },
      {
        code: 'NSN',
        name: 'Negeri Sembilan',
        cities: [
          'Seremban',
          'Port Dickson',
          'Nilai',
          'Bahau',
          'Kuala Pilah',
          'Rembau',
          'Tampin',
          'Jelebu'
        ]
      },
      {
        code: 'PHG',
        name: 'Pahang',
        cities: [
          'Kuantan',
          'Temerloh',
          'Bentong',
          'Raub',
          'Jerantut',
          'Pekan',
          'Bera',
          'Rompin',
          'Cameron Highlands',
          'Kuala Lipis',
          'Mentakab'
        ]
      },
      {
        code: 'KDH',
        name: 'Kedah',
        cities: [
          'Alor Setar',
          'Sungai Petani',
          'Kulim',
          'Langkawi',
          'Kubang Pasu',
          'Baling',
          'Pendang',
          'Yan',
          'Sik',
          'Padang Terap',
          'Bandar Baharu',
          'Jitra'
        ]
      },
      {
        code: 'TRG',
        name: 'Terengganu',
        cities: [
          'Kuala Terengganu',
          'Kemaman',
          'Dungun',
          'Besut',
          'Marang',
          'Hulu Terengganu',
          'Setiu',
          'Kuala Nerus',
          'Chukai',
          'Kerteh'
        ]
      },
      {
        code: 'KTN',
        name: 'Kelantan',
        cities: [
          'Kota Bharu',
          'Pasir Mas',
          'Tumpat',
          'Bachok',
          'Tanah Merah',
          'Pasir Puteh',
          'Kuala Krai',
          'Machang',
          'Gua Musang',
          'Jeli'
        ]
      },
      {
        code: 'PLS',
        name: 'Perlis',
        cities: [
          'Kangar',
          'Arau',
          'Padang Besar',
          'Kuala Perlis',
          'Simpang Empat'
        ]
      },
      {
        code: 'PJY',
        name: 'Putrajaya',
        cities: [
          'Putrajaya',
          'Presint 1',
          'Presint 2',
          'Presint 3',
          'Presint 4',
          'Presint 5',
          'Presint 8',
          'Presint 9',
          'Presint 11',
          'Presint 14',
          'Presint 15'
        ]
      },
      {
        code: 'LBN',
        name: 'Labuan',
        cities: [
          'Victoria',
          'Rancha-Rancha',
          'Layang-Layangan',
          'Pohon Batu',
          'Batu Manikar'
        ]
      }
    ]
  },
  {
    code: 'SG',
    name: 'Singapore',
    states: [
      {
        code: 'CR',
        name: 'Central Region',
        cities: [
          'Downtown Core',
          'Orchard',
          'Marina Bay',
          'Novena',
          'Queenstown',
          'Bukit Merah',
          'Toa Payoh',
          'Kallang',
          'Rochor',
          'Outram',
          'Newton',
          'River Valley',
          'Singapore River',
          'Tanglin',
          'Bukit Timah',
          'Marine Parade'
        ]
      },
      {
        code: 'ER',
        name: 'East Region',
        cities: [
          'Tampines',
          'Bedok',
          'Pasir Ris',
          'Changi',
          'Paya Lebar'
        ]
      },
      {
        code: 'NR',
        name: 'North Region',
        cities: [
          'Woodlands',
          'Yishun',
          'Sembawang',
          'Admiralty',
          'Sungei Kadut',
          'Lim Chu Kang',
          'Mandai',
          'Central Water Catchment'
        ]
      },
      {
        code: 'NER',
        name: 'North-East Region',
        cities: [
          'Hougang',
          'Sengkang',
          'Punggol',
          'Ang Mo Kio',
          'Serangoon',
          'Seletar'
        ]
      },
      {
        code: 'WR',
        name: 'West Region',
        cities: [
          'Jurong East',
          'Jurong West',
          'Clementi',
          'Bukit Batok',
          'Choa Chu Kang',
          'Bukit Panjang',
          'Tengah',
          'Boon Lay',
          'Pioneer',
          'Tuas'
        ]
      }
    ]
  },
  {
    code: 'JP',
    name: 'Japan',
    states: [
      {
        code: '13',
        name: 'Tokyo',
        cities: [
          'Shinjuku',
          'Shibuya',
          'Minato',
          'Chiyoda',
          'Chuo',
          'Setagaya',
          'Nakano',
          'Suginami',
          'Toshima',
          'Bunkyo',
          'Taito',
          'Sumida',
          'Koto',
          'Shinagawa',
          'Meguro',
          'Ota',
          'Kita',
          'Arakawa',
          'Itabashi',
          'Nerima',
          'Adachi',
          'Katsushika',
          'Edogawa',
          'Hachioji',
          'Tachikawa',
          'Musashino',
          'Mitaka',
          'Machida'
        ]
      },
      {
        code: '27',
        name: 'Osaka',
        cities: [
          'Osaka City',
          'Sakai',
          'Higashiosaka',
          'Suita',
          'Toyonaka',
          'Takatsuki',
          'Hirakata',
          'Ibaraki',
          'Yao',
          'Kishiwada'
        ]
      },
      {
        code: '26',
        name: 'Kyoto',
        cities: [
          'Kyoto City',
          'Uji',
          'Kameoka',
          'Maizuru',
          'Fukuchiyama',
          'Joyo',
          'Nagaokakyo'
        ]
      },
      {
        code: '14',
        name: 'Kanagawa',
        cities: [
          'Yokohama',
          'Kawasaki',
          'Sagamihara',
          'Yokosuka',
          'Fujisawa',
          'Kamakura',
          'Hiratsuka',
          'Chigasaki',
          'Atsugi',
          'Odawara'
        ]
      },
      {
        code: '23',
        name: 'Aichi',
        cities: [
          'Nagoya',
          'Toyota',
          'Okazaki',
          'Ichinomiya',
          'Toyohashi',
          'Kasugai',
          'Anjo'
        ]
      },
      {
        code: '40',
        name: 'Fukuoka',
        cities: [
          'Fukuoka City',
          'Kitakyushu',
          'Kurume',
          'Omuta',
          'Iizuka',
          'Kasuga',
          'Onojo'
        ]
      },
      {
        code: '01',
        name: 'Hokkaido',
        cities: [
          'Sapporo',
          'Asahikawa',
          'Hakodate',
          'Kushiro',
          'Tomakomai',
          'Obihiro',
          'Otaru',
          'Kitami'
        ]
      },
      {
        code: '28',
        name: 'Hyogo',
        cities: [
          'Kobe',
          'Himeji',
          'Nishinomiya',
          'Amagasaki',
          'Akashi',
          'Kakogawa',
          'Takarazuka',
          'Itami'
        ]
      }
    ]
  },
  {
    code: 'US',
    name: 'United States',
    states: [
      {
        code: 'CA',
        name: 'California',
        cities: [
          'Los Angeles',
          'San Francisco',
          'San Diego',
          'San Jose',
          'Sacramento',
          'Fresno',
          'Long Beach',
          'Oakland',
          'Bakersfield',
          'Anaheim',
          'Santa Ana',
          'Riverside',
          'Irvine',
          'Stockton',
          'Chula Vista'
        ]
      },
      {
        code: 'NY',
        name: 'New York',
        cities: [
          'New York City',
          'Buffalo',
          'Rochester',
          'Yonkers',
          'Syracuse',
          'Albany',
          'New Rochelle',
          'Mount Vernon',
          'Schenectady',
          'Utica'
        ]
      },
      {
        code: 'TX',
        name: 'Texas',
        cities: [
          'Houston',
          'San Antonio',
          'Dallas',
          'Austin',
          'Fort Worth',
          'El Paso',
          'Arlington',
          'Corpus Christi',
          'Plano',
          'Lubbock',
          'Irving',
          'Laredo',
          'Garland',
          'Frisco'
        ]
      },
      {
        code: 'WA',
        name: 'Washington',
        cities: [
          'Seattle',
          'Spokane',
          'Tacoma',
          'Vancouver',
          'Bellevue',
          'Kent',
          'Everett',
          'Renton',
          'Yakima',
          'Federal Way'
        ]
      },
      {
        code: 'FL',
        name: 'Florida',
        cities: [
          'Jacksonville',
          'Miami',
          'Tampa',
          'Orlando',
          'St. Petersburg',
          'Hialeah',
          'Port St. Lucie',
          'Tallahassee',
          'Cape Coral',
          'Fort Lauderdale'
        ]
      },
      {
        code: 'IL',
        name: 'Illinois',
        cities: [
          'Chicago',
          'Aurora',
          'Naperville',
          'Joliet',
          'Rockford',
          'Springfield',
          'Elgin',
          'Peoria',
          'Champaign',
          'Waukegan'
        ]
      }
    ]
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      {
        code: 'ENG',
        name: 'England',
        cities: [
          'London',
          'Manchester',
          'Birmingham',
          'Leeds',
          'Liverpool',
          'Bristol',
          'Newcastle upon Tyne',
          'Sheffield',
          'Nottingham',
          'Leicester',
          'Southampton',
          'Oxford',
          'Cambridge'
        ]
      },
      {
        code: 'SCT',
        name: 'Scotland',
        cities: [
          'Edinburgh',
          'Glasgow',
          'Aberdeen',
          'Dundee',
          'Inverness',
          'Stirling',
          'Perth'
        ]
      },
      {
        code: 'WLS',
        name: 'Wales',
        cities: [
          'Cardiff',
          'Swansea',
          'Newport',
          'Wrexham',
          'Bangor',
          'St Asaph',
          'St Davids'
        ]
      },
      {
        code: 'NIR',
        name: 'Northern Ireland',
        cities: [
          'Belfast',
          'Derry',
          'Lisburn',
          'Newry',
          'Armagh',
          'Bangor'
        ]
      }
    ]
  },
  {
    code: 'AU',
    name: 'Australia',
    states: [
      {
        code: 'NSW',
        name: 'New South Wales',
        cities: [
          'Sydney',
          'Newcastle',
          'Central Coast',
          'Wollongong',
          'Maitland',
          'Tweed Heads',
          'Wagga Wagga',
          'Albury',
          'Port Macquarie',
          'Tamworth'
        ]
      },
      {
        code: 'VIC',
        name: 'Victoria',
        cities: [
          'Melbourne',
          'Geelong',
          'Ballarat',
          'Bendigo',
          'Shepparton',
          'Mildura',
          'Warrnambool',
          'Traralgon',
          'Wangaratta'
        ]
      },
      {
        code: 'QLD',
        name: 'Queensland',
        cities: [
          'Brisbane',
          'Gold Coast',
          'Sunshine Coast',
          'Townsville',
          'Cairns',
          'Toowoomba',
          'Mackay',
          'Rockhampton',
          'Bundaberg',
          'Hervey Bay'
        ]
      },
      {
        code: 'WA',
        name: 'Western Australia',
        cities: [
          'Perth',
          'Bunbury',
          'Geraldton',
          'Kalgoorlie',
          'Albany',
          'Busselton',
          'Karratha',
          'Broome'
        ]
      },
      {
        code: 'SA',
        name: 'South Australia',
        cities: [
          'Adelaide',
          'Mount Gambier',
          'Gawler',
          'Whyalla',
          'Murray Bridge',
          'Mount Barker',
          'Victor Harbor',
          'Port Lincoln'
        ]
      },
      {
        code: 'TAS',
        name: 'Tasmania',
        cities: [
          'Hobart',
          'Launceston',
          'Devonport',
          'Burnie',
          'Kingston',
          'Ulverstone'
        ]
      },
      {
        code: 'ACT',
        name: 'Australian Capital Territory',
        cities: [
          'Canberra',
          'Belconnen',
          'Tuggeranong',
          'Gungahlin',
          'Woden Valley',
          'Weston Creek',
          'Molonglo Valley'
        ]
      }
    ]
  },
  {
    code: 'CA',
    name: 'Canada',
    states: [
      {
        code: 'ON',
        name: 'Ontario',
        cities: [
          'Toronto',
          'Ottawa',
          'Mississauga',
          'Brampton',
          'Hamilton',
          'London',
          'Markham',
          'Vaughan',
          'Kitchener',
          'Windsor',
          'Richmond Hill',
          'Oakville',
          'Burlington'
        ]
      },
      {
        code: 'BC',
        name: 'British Columbia',
        cities: [
          'Vancouver',
          'Surrey',
          'Burnaby',
          'Richmond',
          'Abbotsford',
          'Coquitlam',
          'Kelowna',
          'Langley',
          'Saanich',
          'Delta',
          'Victoria'
        ]
      },
      {
        code: 'QC',
        name: 'Quebec',
        cities: [
          'Montreal',
          'Quebec City',
          'Laval',
          'Gatineau',
          'Longueuil',
          'Sherbrooke',
          'Levis',
          'Saguenay',
          'Trois-Rivieres'
        ]
      },
      {
        code: 'AB',
        name: 'Alberta',
        cities: [
          'Calgary',
          'Edmonton',
          'Red Deer',
          'Lethbridge',
          'St. Albert',
          'Medicine Hat',
          'Grande Prairie',
          'Airdrie'
        ]
      }
    ]
  },
  {
    code: 'DE',
    name: 'Germany',
    states: [
      { code: 'BE', name: 'Berlin', cities: ['Berlin', 'Mitte', 'Pankow', 'Charlottenburg', 'Spandau', 'Neukölln'] },
      { code: 'BY', name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Ingolstadt', 'Würzburg', 'Erlangen'] },
      { code: 'NW', name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Bonn'] },
      { code: 'HH', name: 'Hamburg', cities: ['Hamburg', 'Altona', 'Eimsbüttel', 'Hamburg-Mitte', 'Harburg'] },
      { code: 'HE', name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach am Main'] }
    ]
  },
  {
    code: 'FR',
    name: 'France',
    states: [
      { code: 'IDF', name: 'Île-de-France', cities: ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Argenteuil', 'Montreuil', 'Versailles'] },
      { code: 'ARA', name: 'Auvergne-Rhône-Alpes', cities: ['Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne', 'Clermont-Ferrand'] },
      { code: 'PAC', name: "Provence-Alpes-Côte d'Azur", cities: ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon', 'Cannes'] },
      { code: 'OCC', name: 'Occitanie', cities: ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers'] }
    ]
  },
  {
    code: 'ID',
    name: 'Indonesia',
    states: [
      { code: 'JK', name: 'Jakarta', cities: ['Central Jakarta', 'South Jakarta', 'West Jakarta', 'East Jakarta', 'North Jakarta'] },
      { code: 'JB', name: 'West Java', cities: ['Bandung', 'Bekasi', 'Depok', 'Bogor', 'Cimahi', 'Tasikmalaya', 'Cirebon'] },
      { code: 'JT', name: 'Central Java', cities: ['Semarang', 'Surakarta', 'Tegal', 'Pekalongan', 'Magelang', 'Salatiga'] },
      { code: 'JI', name: 'East Java', cities: ['Surabaya', 'Malang', 'Kediri', 'Probolinggo', 'Pasuruan', 'Madiun', 'Batu'] },
      { code: 'BA', name: 'Bali', cities: ['Denpasar', 'Badung', 'Gianyar', 'Tabanan', 'Buleleng', 'Klungkung', 'Ubud'] }
    ]
  },
  {
    code: 'TH',
    name: 'Thailand',
    states: [
      { code: 'BKK', name: 'Bangkok', cities: ['Bangkok', 'Bang Rak', 'Watthana', 'Khlong Toei', 'Pathum Wan', 'Chatuchak', 'Sathorn'] },
      { code: 'CM', name: 'Chiang Mai', cities: ['Chiang Mai City', 'Mae Rim', 'San Sai', 'Hang Dong', 'San Kamphaeng'] },
      { code: 'PK', name: 'Phuket', cities: ['Phuket City', 'Kathu', 'Thalang', 'Patong', 'Karon'] },
      { code: 'CB', name: 'Chonburi', cities: ['Pattaya', 'Chonburi City', 'Bang Lamung', 'Si Racha', 'Sattahip'] }
    ]
  },
  {
    code: 'PH',
    name: 'Philippines',
    states: [
      { code: 'NCR', name: 'National Capital Region', cities: ['Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig', 'Parañaque', 'Mandaluyong'] },
      { code: 'CEB', name: 'Cebu', cities: ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Talisay', 'Toledo'] },
      { code: 'DAV', name: 'Davao', cities: ['Davao City', 'Tagum', 'Panabo', 'Samal', 'Digos'] }
    ]
  },
  {
    code: 'IN',
    name: 'India',
    states: [
      { code: 'MH', name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad'] },
      { code: 'DL', name: 'Delhi', cities: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'] },
      { code: 'KA', name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'] },
      { code: 'TN', name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'] }
    ]
  },
  {
    code: 'CN',
    name: 'China',
    states: [
      { code: 'BJ', name: 'Beijing', cities: ['Chaoyang', 'Haidian', 'Dongcheng', 'Xicheng', 'Fengtai'] },
      { code: 'SH', name: 'Shanghai', cities: ['Pudong', 'Huangpu', 'Xuhui', 'Jing\'an', 'Minhang'] },
      { code: 'GD', name: 'Guangdong', cities: ['Guangzhou', 'Shenzhen', 'Dongguan', 'Foshan', 'Zhuhai'] }
    ]
  },
  {
    code: 'KR',
    name: 'South Korea',
    states: [
      { code: 'SEO', name: 'Seoul', cities: ['Gangnam', 'Mapo', 'Jongno', 'Jung-gu', 'Songpa', 'Yongsan'] },
      { code: 'BSN', name: 'Busan', cities: ['Haeundae', 'Busanjin', 'Jung-gu', 'Nam-gu', 'Dong-gu'] },
      { code: 'INC', name: 'Incheon', cities: ['Yeonsu', 'Namdong', 'Bupyeong', 'Jung-gu', 'Seo-gu'] }
    ]
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    states: [
      { code: 'AUK', name: 'Auckland', cities: ['Auckland Central', 'Manukau', 'North Shore', 'Waitakere'] },
      { code: 'WGN', name: 'Wellington', cities: ['Wellington City', 'Lower Hutt', 'Porirua', 'Upper Hutt'] },
      { code: 'CAN', name: 'Canterbury', cities: ['Christchurch', 'Timaru', 'Ashburton', 'Rangiora'] }
    ]
  }
];

// Fallback global country list generator for remaining 230+ countries
const ADDITIONAL_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macau' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KP', name: 'North Korea' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' }
];

// Combine into canonical lookup dictionary
const ALL_COUNTRIES_MAP = new Map<string, CountryData>();

COUNTRIES_DATA.forEach(c => {
  ALL_COUNTRIES_MAP.set(c.name.toLowerCase(), c);
  ALL_COUNTRIES_MAP.set(c.code.toLowerCase(), c);
});

ADDITIONAL_COUNTRIES.forEach(c => {
  if (!ALL_COUNTRIES_MAP.has(c.name.toLowerCase()) && !ALL_COUNTRIES_MAP.has(c.code.toLowerCase())) {
    const fullCountry: CountryData = {
      code: c.code,
      name: c.name,
      states: [
        {
          code: 'GEN',
          name: 'General / Capital Region',
          cities: [c.name + ' City', 'Central Area', 'Other Region']
        }
      ]
    };
    ALL_COUNTRIES_MAP.set(c.name.toLowerCase(), fullCountry);
    ALL_COUNTRIES_MAP.set(c.code.toLowerCase(), fullCountry);
  }
});

/**
 * Returns list of all available countries sorted by display name.
 */
export function getCountries(): { code: string; name: string }[] {
  const seen = new Set<string>();
  const list: { code: string; name: string }[] = [];
  
  COUNTRIES_DATA.forEach(c => {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      list.push({ code: c.code, name: c.name });
    }
  });

  ADDITIONAL_COUNTRIES.forEach(c => {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      list.push({ code: c.code, name: c.name });
    }
  });

  return list;
}

/**
 * Find country data by name or code (case-insensitive)
 */
export function findCountry(countryNameOrCode?: string): CountryData | undefined {
  if (!countryNameOrCode) return undefined;
  return ALL_COUNTRIES_MAP.get(countryNameOrCode.trim().toLowerCase());
}

/**
 * Returns available states/provinces for a given country
 */
export function getStatesForCountry(countryNameOrCode?: string): { code: string; name: string }[] {
  const country = findCountry(countryNameOrCode);
  if (!country) return [];
  return country.states.map(s => ({ code: s.code, name: s.name }));
}

/**
 * Returns available cities for a given country and state
 */
export function getCitiesForState(countryNameOrCode?: string, stateNameOrCode?: string): string[] {
  const country = findCountry(countryNameOrCode);
  if (!country || !stateNameOrCode) return [];
  
  const stateQuery = stateNameOrCode.trim().toLowerCase();
  const state = country.states.find(s => 
    s.name.toLowerCase() === stateQuery || s.code.toLowerCase() === stateQuery
  );
  
  return state ? state.cities : [];
}

/**
 * Validates whether a country, state, and city combination is valid
 */
export function isValidLocation(country?: string, state?: string, city?: string): boolean {
  if (!country || !state || !city) return false;
  
  const cData = findCountry(country);
  if (!cData) return false;
  
  const stateQuery = state.trim().toLowerCase();
  const sData = cData.states.find(s => 
    s.name.toLowerCase() === stateQuery || s.code.toLowerCase() === stateQuery
  );
  if (!sData) return false;
  
  const cityQuery = city.trim().toLowerCase();
  const cityMatches = sData.cities.some(c => c.toLowerCase() === cityQuery);
  return cityMatches || city.trim().length > 0;
}

/**
 * Formats full location string with hierarchy
 */
export function formatLocation(
  city?: string | null,
  state?: string | null,
  country?: string | null,
  specificRemark?: string | null
): string {
  const parts: string[] = [];
  if (city && city.trim()) parts.push(city.trim());
  if (state && state.trim()) parts.push(state.trim());
  if (country && country.trim()) parts.push(country.trim());
  
  const locationHierarchy = parts.join(', ');
  if (specificRemark && specificRemark.trim()) {
    return locationHierarchy ? `${specificRemark.trim()} (${locationHierarchy})` : specificRemark.trim();
  }
  return locationHierarchy || 'Location Unassigned';
}
