// Generate 2,000+ experts with realistic Western names (USA, UK, Europe, Australia)
import { allSubjects } from './subjects'

// Realistic first names mix of USA, UK, European, Australian
const firstNames = {
  male: [
    // USA
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
    'Kenneth', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan',
    'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
    'Benjamin', 'Samuel', 'Frank', 'Gregory', 'Raymond', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry',
    // UK / European
    'Oliver', 'Harry', 'George', 'Noah', 'Jack', 'Leo', 'Oscar', 'Charlie', 'Henry', 'Theodore',
    'Sebastian', 'Hugo', 'Felix', 'Arthur', 'Edmund', 'Rupert', 'Nathaniel', 'Maxwell', 'Lucas', 'Alistair',
    // Australian
    'Lachlan', 'Hudson', 'Mason', 'Cooper', 'Riley', 'Beau', 'Hayden', 'Tyson', 'Jett', 'Kai',
    // German / Scandinavian / Other European
    'Lukas', 'Anders', 'Erik', 'Mikael', 'Hans', 'Klaus', 'Stefan', 'Friedrich', 'Wilhelm', 'Marcel',
    'Pierre', 'Jean', 'Philippe', 'Laurent', 'Luc', 'Antoine', 'Marco', 'Luca', 'Matteo', 'Giovanni',
    'Diego', 'Pablo', 'Alejandro', 'Carlos', 'Rafael', 'Niels', 'Lars', 'Magnus', 'Henrik', 'Sven'
  ],
  female: [
    // USA
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Lisa', 'Nancy', 'Betty', 'Sandra', 'Margaret', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
    'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia', 'Amy',
    'Kathleen', 'Angela', 'Shirley', 'Brenda', 'Anna', 'Pamela', 'Emma', 'Nicole', 'Samantha', 'Katherine',
    'Christine', 'Helen', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Maria', 'Catherine', 'Heather', 'Diana',
    // UK / European
    'Olivia', 'Amelia', 'Isla', 'Ava', 'Mia', 'Sophia', 'Grace', 'Lily', 'Freya', 'Charlotte',
    'Eleanor', 'Beatrice', 'Florence', 'Matilda', 'Penelope', 'Harriet', 'Imogen', 'Cordelia', 'Genevieve', 'Isabella',
    // Australian
    'Chloe', 'Mila', 'Zara', 'Ruby', 'Willow', 'Indi', 'Frankie', 'Sienna', 'Harper', 'Elsie',
    // European
    'Sophie', 'Camille', 'Margot', 'Juliette', 'Léa', 'Greta', 'Ingrid', 'Astrid', 'Freja', 'Annika',
    'Giulia', 'Sofia', 'Chiara', 'Valentina', 'Gabriella', 'Elena', 'Lucia', 'Martina', 'Bianca', 'Aurora'
  ]
}

const lastNames = [
  // USA / British
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Phillips', 'Evans', 'Turner', 'Parker', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook',
  // UK
  'Bennett', 'Hughes', 'Russell', 'Cooper', 'Watson', 'Holmes', 'Hamilton', 'Whitaker', 'Pemberton', 'Ashford',
  'Blackwood', 'Cromwell', 'Davenport', 'Ellsworth', 'Fairfax', 'Gainsborough', 'Hartley', 'Kensington', 'Langford', 'Montgomery',
  // German
  'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
  // French
  'Dubois', 'Bernard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre',
  // Italian / Spanish
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
  // Scandinavian
  'Andersen', 'Nielsen', 'Hansen', 'Pedersen', 'Christensen', 'Larsen', 'Sorensen', 'Rasmussen', 'Jorgensen', 'Olsen',
  // Australian-distinctive surnames
  'Murray', 'Bailey', 'Reed', 'Cox', 'Howard', 'Ward', 'Foster', 'Brooks', 'Bell', 'Murphy'
]

// Countries with weighted distribution (code is for flagcdn.com)
const countries = [
  { name: 'United States', code: 'us', flag: '🇺🇸', weight: 30 },
  { name: 'United Kingdom', code: 'gb', flag: '🇬🇧', weight: 20 },
  { name: 'Australia', code: 'au', flag: '🇦🇺', weight: 15 },
  { name: 'Canada', code: 'ca', flag: '🇨🇦', weight: 10 },
  { name: 'Germany', code: 'de', flag: '🇩🇪', weight: 7 },
  { name: 'France', code: 'fr', flag: '🇫🇷', weight: 5 },
  { name: 'Netherlands', code: 'nl', flag: '🇳🇱', weight: 4 },
  { name: 'Sweden', code: 'se', flag: '🇸🇪', weight: 3 },
  { name: 'Italy', code: 'it', flag: '🇮🇹', weight: 3 },
  { name: 'Spain', code: 'es', flag: '🇪🇸', weight: 3 }
]

const universities = [
  // USA
  'Harvard University', 'Stanford University', 'MIT', 'Princeton University', 'Yale University',
  'Columbia University', 'University of Chicago', 'UPenn', 'Caltech', 'Johns Hopkins',
  'Northwestern University', 'Duke University', 'UC Berkeley', 'Cornell University', 'UCLA',
  'University of Michigan', 'NYU', 'Carnegie Mellon', 'Georgetown', 'University of Texas',
  // UK
  'University of Oxford', 'University of Cambridge', 'Imperial College London', 'UCL',
  'King\'s College London', 'LSE', 'University of Edinburgh', 'University of Manchester',
  'University of Bristol', 'University of Warwick',
  // Australia
  'University of Melbourne', 'Australian National University', 'University of Sydney',
  'University of Queensland', 'Monash University', 'UNSW Sydney', 'University of Western Australia',
  // Europe
  'ETH Zurich', 'TU Munich', 'University of Amsterdam', 'KU Leuven', 'Sorbonne University',
  'Karolinska Institute', 'University of Copenhagen', 'University of Toronto', 'McGill University'
]

const degrees = ['PhD', 'PhD', 'PhD', 'PhD', 'MS', 'MA', 'MBA', 'MEng']

// Bio templates
const bioTemplates = [
  '{degree} graduate with {years}+ years of academic and industry experience in {subject}. Specializes in helping students master complex topics through clear, structured explanations.',
  'Experienced {subject} expert from {university}. {years} years of helping students at all academic levels achieve top grades. Known for clear writing and timely delivery.',
  'Highly-rated {subject} specialist with {years}+ years on AssignPro. Published in peer-reviewed journals, with hands-on industry experience. Loves teaching.',
  '{degree} in {subject} from {university}. Has helped {projects}+ students excel in their assignments. Passionate about quality, originality, and student success.',
  'Senior {subject} consultant and academic mentor. {years} years of experience tutoring and writing scholarly work. Available for urgent and complex orders.'
]

// Seedable random generator for consistent data
let seed = 42
const seededRandom = () => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

const pickRandom = (arr) => arr[Math.floor(seededRandom() * arr.length)]
const pickWeighted = (arr) => {
  const total = arr.reduce((sum, item) => sum + item.weight, 0)
  let r = seededRandom() * total
  for (const item of arr) {
    if ((r -= item.weight) < 0) return item
  }
  return arr[0]
}
const randomBetween = (min, max) => Math.floor(seededRandom() * (max - min + 1)) + min

const generateExperts = () => {
  seed = 42 // reset seed for consistency
  const experts = []
  const totalCount = 2034 // "2,000+ experts"

  // Randomize the percentage of online experts per page load (between 1% and 98%)
  const targetOnlinePercentage = 0.01 + Math.random() * 0.97


  for (let i = 0; i < totalCount; i++) {
    const isMale = seededRandom() > 0.45 // slightly more males
    const firstName = pickRandom(isMale ? firstNames.male : firstNames.female)
    const lastName = pickRandom(lastNames)
    const country = pickWeighted(countries)
    const university = pickRandom(universities)
    const degree = pickRandom(degrees)

    // Each expert specializes in 1-3 subjects
    const numSubjects = randomBetween(1, 3)
    const expertSubjects = []
    const usedIndices = new Set()
    while (expertSubjects.length < numSubjects) {
      const idx = Math.floor(seededRandom() * allSubjects.length)
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx)
        expertSubjects.push(allSubjects[idx])
      }
    }

    const primarySubject = expertSubjects[0]
    const years = randomBetween(3, 18)
    const projects = randomBetween(50, 1800)
    const rating = (4.5 + seededRandom() * 0.5).toFixed(2)
    const reviewCount = randomBetween(20, 800)

    // completely random chance for each expert to be online on every load
    const isOnline = Math.random() < targetOnlinePercentage
    
    // Top rated: rating >= 4.85 AND projects >= 500
    const isTopRated = parseFloat(rating) >= 4.85 && projects >= 500


    const bioTemplate = pickRandom(bioTemplates)
    const bio = bioTemplate
      .replace('{degree}', degree)
      .replace('{years}', years)
      .replace('{subject}', primarySubject.name)
      .replace('{university}', university)
      .replace('{projects}', projects)

    const initials = (firstName[0] + lastName[0]).toUpperCase()

    // Use prefix "Dr." for PhD holders ~70% of the time
    const titlePrefix = degree === 'PhD' && seededRandom() < 0.7 ? 'Dr. ' : ''

    const avatarIndex = (i % 70) + 1
    const avatarGender = isMale ? 'men' : 'women'
    const avatarUrl = `https://randomuser.me/api/portraits/${avatarGender}/${avatarIndex}.jpg`

    experts.push({
      id: i + 1,
      name: `${titlePrefix}${firstName} ${lastName}`,
      initials,
      avatarUrl,
      isMale,
      degree,
      university,
      country: country.name,
      countryCode: country.code,
      flag: country.flag,
      subjects: expertSubjects,
      primarySubject: primarySubject.name,
      primarySubjectIcon: primarySubject.icon,
      years,
      projects,
      rating: parseFloat(rating),
      reviewCount,
      isOnline,
      isTopRated,
      bio,
      hourlyRate: randomBetween(15, 75)
    })
  }

  return experts
}

// Cache the result
let _experts = null
export const getAllExperts = () => {
  if (!_experts) _experts = generateExperts()
  return _experts
}

// Re-randomize the online status of all experts
// Uses Math.random (not seeded) so it changes every call
export const refreshOnlineStatus = () => {
  if (!_experts) _experts = generateExperts()

  // Pick a new random target percentage for the refresh
  const targetOnlinePercentage = 0.01 + Math.random() * 0.97

  _experts.forEach(expert => {
    expert.isOnline = Math.random() < targetOnlinePercentage
  })

  // Return a new array reference so React detects the change
  return [..._experts]
}
