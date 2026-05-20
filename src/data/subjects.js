// Subject data each subject has its own content
// To add detailed content for any subject, create an entry with the slug as the key

// Slug helper (must match Header.jsx)
export const slugify = (text) =>
  text.toLowerCase()
    .replace(/[\/&]/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

// Full list of subjects with their categories
export const allSubjects = [
  { name: 'Essay Writing', category: 'Academic & Writing', icon: '✍️' },
  { name: 'Editing And Proofreading', category: 'Academic & Writing', icon: '📝' },
  { name: 'Business Writing', category: 'Academic & Writing', icon: '💼' },
  { name: 'Resume Writing', category: 'Academic & Writing', icon: '📄' },
  { name: 'Cover Letter', category: 'Academic & Writing', icon: '📋' },
  { name: 'Presentation', category: 'Academic & Writing', icon: '📊' },
  { name: 'Excel', category: 'Academic & Writing', icon: '📈' },

  { name: 'Computer Science', category: 'Computer Science & IT', icon: '💻' },
  { name: 'Computer Architecture', category: 'Computer Science & IT', icon: '🖥️' },
  { name: 'Computer Network Security', category: 'Computer Science & IT', icon: '🔒' },
  { name: 'Computer Graphics and Multimedia Applications', category: 'Computer Science & IT', icon: '🎨' },
  { name: 'Data Structures', category: 'Computer Science & IT', icon: '🌳' },
  { name: 'Database Management System', category: 'Computer Science & IT', icon: '🗄️' },
  { name: 'Design and Analysis of Algorithms', category: 'Computer Science & IT', icon: '⚙️' },
  { name: 'Information Technology', category: 'Computer Science & IT', icon: '💡' },
  { name: 'Networking', category: 'Computer Science & IT', icon: '🌐' },
  { name: 'Operating System', category: 'Computer Science & IT', icon: '🖱️' },
  { name: 'Software Engineering', category: 'Computer Science & IT', icon: '🛠️' },
  { name: 'Software Testing', category: 'Computer Science & IT', icon: '🧪' },
  { name: 'Linux Environment', category: 'Computer Science & IT', icon: '🐧' },
  { name: 'IoT Internet Of Things', category: 'Computer Science & IT', icon: '📡' },

  { name: 'Programming Languages', category: 'Programming Languages', icon: '⌨️' },
  { name: 'Java Programming', category: 'Programming Languages', icon: '☕' },
  { name: 'Python Programming', category: 'Programming Languages', icon: '🐍' },
  { name: 'C/C++ Programming', category: 'Programming Languages', icon: '⚡' },
  { name: 'R Programming', category: 'Programming Languages', icon: '📊' },
  { name: 'Visual Basic/C#', category: 'Programming Languages', icon: '🔷' },
  { name: 'PHP', category: 'Programming Languages', icon: '🐘' },
  { name: 'PERL', category: 'Programming Languages', icon: '🦪' },
  { name: 'Haskell Programming', category: 'Programming Languages', icon: 'λ' },
  { name: 'Scripting', category: 'Programming Languages', icon: '📜' },
  { name: 'ASP.NET', category: 'Programming Languages', icon: '🔵' },
  { name: 'MATHEMATICA WOLFRAM Programming', category: 'Programming Languages', icon: '🧮' },
  { name: 'MATLAB', category: 'Programming Languages', icon: '📐' },

  { name: 'Data Science', category: 'Data & AI', icon: '📊' },
  { name: 'Data Mining', category: 'Data & AI', icon: '⛏️' },
  { name: 'Big Data', category: 'Data & AI', icon: '💾' },
  { name: 'Machine Learning', category: 'Data & AI', icon: '🤖' },
  { name: 'Artificial Intelligence', category: 'Data & AI', icon: '🧠' },
  { name: 'Automata or Computation', category: 'Data & AI', icon: '🔢' },
  { name: 'TABLEAU', category: 'Data & AI', icon: '📈' },
  { name: 'SAS', category: 'Data & AI', icon: '📉' },
  { name: 'SAP', category: 'Data & AI', icon: '🏢' },
  { name: 'Statistics', category: 'Data & AI', icon: '📊' },

  { name: 'Web Development', category: 'Web & App Development', icon: '🌐' },
  { name: 'Android Development', category: 'Web & App Development', icon: '📱' },
  { name: 'IOS Development', category: 'Web & App Development', icon: '🍎' },

  { name: 'Engineering', category: 'Engineering', icon: '⚙️' },
  { name: 'Aeronautical Engineering', category: 'Engineering', icon: '✈️' },
  { name: 'Biomedical Engineering', category: 'Engineering', icon: '🧬' },
  { name: 'Chemical Engineering', category: 'Engineering', icon: '⚗️' },
  { name: 'Chemical And Biomolecular Engineering', category: 'Engineering', icon: '🧪' },
  { name: 'Civil Engineering', category: 'Engineering', icon: '🏗️' },
  { name: 'Civil Engineer Structures', category: 'Engineering', icon: '🏛️' },
  { name: 'Construction Management', category: 'Engineering', icon: '👷' },
  { name: 'Electrical Engineering', category: 'Engineering', icon: '⚡' },
  { name: 'Electronic Engineering', category: 'Engineering', icon: '🔌' },
  { name: 'Environmental Engineering', category: 'Engineering', icon: '🌿' },
  { name: 'Geotechnical Engineering', category: 'Engineering', icon: '🪨' },
  { name: 'Mechanical Engineering', category: 'Engineering', icon: '⚙️' },
  { name: 'Transport Engineering', category: 'Engineering', icon: '🚛' },

  { name: 'Biology', category: 'Sciences', icon: '🧬' },
  { name: 'Chemistry', category: 'Sciences', icon: '⚗️' },
  { name: 'Physics', category: 'Sciences', icon: '⚛️' },
  { name: 'Geothermal Physics', category: 'Sciences', icon: '🌋' },
  { name: 'Geo Studies', category: 'Sciences', icon: '🌍' },
  { name: 'Geography', category: 'Sciences', icon: '🗺️' },
  { name: 'Medical', category: 'Sciences', icon: '⚕️' },
  { name: 'Mathematics', category: 'Sciences', icon: '🔢' },

  { name: 'Accounting', category: 'Business & Management', icon: '🧾' },
  { name: 'Finance', category: 'Business & Management', icon: '💰' },
  { name: 'Economics', category: 'Business & Management', icon: '📈' },
  { name: 'Management', category: 'Business & Management', icon: '👔' },
  { name: 'Project Management', category: 'Business & Management', icon: '📋' },
  { name: 'Taxation', category: 'Business & Management', icon: '🧮' },
  { name: 'Admission Services', category: 'Business & Management', icon: '🎓' },

  { name: 'Humanities', category: 'Humanities & Law', icon: '🏛️' },
  { name: 'English', category: 'Humanities & Law', icon: '📚' },
  { name: 'Law', category: 'Humanities & Law', icon: '⚖️' },
  { name: 'Psychology', category: 'Humanities & Law', icon: '🧠' },
  { name: 'Sociology', category: 'Humanities & Law', icon: '👥' }
]

// Detailed content for specific subjects
// Add more entries here as you customize each subject
export const subjectDetails = {

  'java-programming': {
    name: 'Java Programming',
    icon: '☕',
    category: 'Programming Languages',
    tagline: 'Expert Java assignment help from certified developers',
    description: 'From basic OOP concepts to advanced Spring Boot applications get help with any Java assignment from PhD-level programmers who write working, well-documented code.',
    stats: [
      { num: '5,000+', label: 'Java assignments completed' },
      { num: '4.9/5', label: 'Student rating' },
      { num: '24h', label: 'Avg. delivery time' },
      { num: '98%', label: 'On-time delivery' }
    ],
    overview: [
      'Java is one of the most popular and widely-used programming languages in the world, powering everything from Android mobile apps and web applications to enterprise systems and big data platforms. Its "write once, run anywhere" philosophy, robust object-oriented design, and massive ecosystem make it a cornerstone of computer science curricula worldwide.',
      'But Java assignments can be tough debugging compilation errors, mastering OOP principles, implementing data structures, working with frameworks like Spring or Hibernate, or building full-stack applications can quickly become overwhelming, especially when juggling multiple courses and deadlines.',
      'That\'s where our Java programming experts come in. Our team includes Oracle-certified Java developers, computer science PhDs, and industry professionals with 10+ years of hands-on experience. Whether you\'re a beginner struggling with loops or a final-year student building a complex enterprise application, we deliver clean, working, well-commented code that you can actually learn from.'
    ],
    topics: [
      { title: 'Core Java Basics', items: ['Variables & Data Types', 'Operators & Control Flow', 'Loops & Iterations', 'Arrays & Strings', 'Methods & Functions'] },
      { title: 'Object-Oriented Programming', items: ['Classes & Objects', 'Inheritance & Polymorphism', 'Encapsulation & Abstraction', 'Interfaces & Abstract Classes', 'Inner Classes'] },
      { title: 'Advanced Java', items: ['Exception Handling', 'Multithreading & Concurrency', 'Collections Framework', 'Generics & Lambdas', 'Stream API'] },
      { title: 'Java I/O & Files', items: ['File Handling', 'Serialization', 'NIO Package', 'Buffered Streams', 'Reader/Writer Classes'] },
      { title: 'Frameworks & Tools', items: ['Spring Framework', 'Spring Boot', 'Hibernate ORM', 'Maven & Gradle', 'JUnit Testing'] },
      { title: 'Enterprise & Web', items: ['Servlets & JSP', 'REST APIs', 'JDBC & Databases', 'Microservices', 'JavaEE / JakartaEE'] },
      { title: 'GUI & Mobile', items: ['Swing & JavaFX', 'Android Development', 'Event-Driven Programming', 'Layout Managers', 'Custom Components'] },
      { title: 'Algorithms & Data Structures', items: ['Sorting & Searching', 'Linked Lists & Trees', 'Graphs & Hash Tables', 'Recursion & Dynamic Programming', 'Time/Space Complexity'] }
    ],
    benefits: [
      { icon: '✅', title: 'Working, Tested Code', desc: 'Every program is compiled, tested, and runs without errors. Includes input/output samples.' },
      { icon: '💡', title: 'Inline Comments', desc: 'Each line of code is explained so you actually understand what\'s happening perfect for learning.' },
      { icon: '🎓', title: 'Oracle-Certified Experts', desc: 'Our Java writers hold OCA, OCP certifications and have 10+ years of professional experience.' },
      { icon: '⚡', title: '3-Hour Turnaround', desc: 'Need it urgently? We deliver simple Java programs in as little as 3 hours.' },
      { icon: '🛡️', title: 'Original Code Only', desc: 'No copy-pasting from Stack Overflow. Every program is written from scratch for your assignment.' },
      { icon: '🔄', title: 'Free Debugging', desc: 'If anything breaks, we fix it free even after delivery. No extra charges, ever.' }
    ],
    samples: [
      { title: 'Bank Management System', desc: 'Full OOP-based banking app with account management, transactions, and JDBC database integration.', tags: ['OOP', 'JDBC', 'Swing'], grade: 'HD (87%)' },
      { title: 'Multithreaded File Server', desc: 'TCP-based file server using Java threads, sockets, and concurrent collections for handling multiple clients.', tags: ['Threads', 'Sockets', 'NIO'], grade: 'A+ (92%)' },
      { title: 'Spring Boot REST API', desc: 'E-commerce REST API with Spring Boot, Hibernate, MySQL, JWT auth, and full CRUD operations.', tags: ['Spring Boot', 'REST', 'JWT'], grade: 'Distinction (89%)' }
    ],
    faqs: [
      { q: 'Do you handle Java frameworks like Spring and Hibernate?', a: 'Absolutely. Our experts work daily with Spring Boot, Hibernate, JPA, Spring Security, and Spring Cloud. Whether it\'s a simple REST API or a full enterprise microservices project, we\'ve got you covered.' },
      { q: 'Will the code compile and run on my machine?', a: 'Yes. We test every program before delivery and provide setup instructions. We also share the exact JDK version used, dependencies, and run commands so it works seamlessly on your end.' },
      { q: 'Can you help with Android Java assignments?', a: 'Yes. We handle Android assignments using both Java and Kotlin. From basic Activity-based apps to complex apps with Firebase, RecyclerView, and Material Design all covered.' },
      { q: 'Do you provide explanations along with the code?', a: 'Every assignment includes detailed inline comments, a README explaining the structure, and (on request) a step-by-step video or document walkthrough so you understand the solution fully.' },
      { q: 'How fast can you deliver a Java assignment?', a: 'Simple programs (data structures, basic OOP): 3-6 hours. Mid-complexity (Swing apps, JDBC): 24 hours. Enterprise projects (Spring Boot, full apps): 2-5 days. Tell us your deadline we\'ll work with it.' }
    ],
    pricing: [
      { tier: 'Basic', desc: 'Simple programs, basic OOP', price: '15', per: '/assignment', features: ['Up to 200 lines of code', 'Inline comments', 'Free testing', 'Free revisions'] },
      { tier: 'Intermediate', desc: 'JDBC, Swing, multithreading', price: '35', per: '/assignment', features: ['Up to 500 lines of code', 'Database integration', 'GUI applications', 'README documentation', 'Priority support'] },
      { tier: 'Advanced', desc: 'Spring Boot, full apps', price: '70+', per: '/assignment', features: ['Enterprise-grade code', 'Framework integration', 'API documentation', 'Deployment guidance', 'Direct chat with developer'] }
    ]
  }

  // Add more subjects below in the same format...
  // 'python-programming': { ... },
  // 'data-science': { ... },

}

// Get subject data returns custom data if exists, otherwise generates default content
export function getSubjectData(slug) {
  // Check if custom data exists
  if (subjectDetails[slug]) {
    return subjectDetails[slug]
  }

  // Otherwise, find the subject in the list and generate default content
  const subjectInfo = allSubjects.find(s => slugify(s.name) === slug)

  if (!subjectInfo) return null

  // Default template for subjects without custom content yet
  return {
    name: subjectInfo.name,
    icon: subjectInfo.icon,
    category: subjectInfo.category,
    tagline: `Expert ${subjectInfo.name} assignment help from PhD specialists`,
    description: `Get top-quality ${subjectInfo.name} assignment help from verified PhD experts. Plagiarism-free, well-researched, delivered on time with free revisions until you're 100% satisfied.`,
    stats: [
      { num: '2,000+', label: `${subjectInfo.name} assignments completed` },
      { num: '4.9/5', label: 'Student rating' },
      { num: '24h', label: 'Avg. delivery time' },
      { num: '98%', label: 'On-time delivery' }
    ],
    overview: [
      `${subjectInfo.name} is one of the most important and widely-studied subjects in modern academia. Students across high school, undergraduate, masters, and PhD levels regularly need help with ${subjectInfo.name} assignments whether it's mastering core concepts, applying theory to real-world problems, or completing complex research projects.`,
      `${subjectInfo.name} assignments often require deep subject knowledge, strong analytical skills, accurate use of academic citations, and the ability to communicate complex ideas clearly. With tight deadlines, multiple courses, and other commitments, even the brightest students need a helping hand.`,
      `That's where AssignPro comes in. Our team of PhD-qualified ${subjectInfo.name} experts has years of academic and industry experience. We provide custom-written, plagiarism-free assignments that meet your university's exact guidelines, complete with proper citations and references so you can submit with confidence and learn from the work we deliver.`
    ],
    topics: [
      { title: 'Foundational Topics', items: ['Core concepts & terminology', 'Historical context & evolution', 'Fundamental principles', 'Key theories & frameworks', 'Basic problem-solving'] },
      { title: 'Intermediate Topics', items: ['Applied case studies', 'Research methodologies', 'Critical analysis', 'Comparative studies', 'Practical applications'] },
      { title: 'Advanced Topics', items: ['Specialized research', 'Contemporary issues', 'Advanced theories', 'Industry-specific applications', 'Emerging trends'] },
      { title: 'Practical Applications', items: ['Real-world projects', 'Case study analysis', 'Industry simulations', 'Hands-on exercises', 'Portfolio building'] },
      { title: 'Research & Writing', items: ['Literature review', 'Methodology design', 'Data interpretation', 'Citations (APA, MLA, Harvard)', 'Academic writing standards'] },
      { title: 'Assessment Types', items: ['Essays & assignments', 'Reports & dissertations', 'Case studies', 'Research papers', 'Presentations & posters'] }
    ],
    benefits: [
      { icon: '🎓', title: 'PhD Experts', desc: `Hand-picked PhD writers specialized in ${subjectInfo.name} with proven academic and research backgrounds.` },
      { icon: '🛡️', title: '100% Original Work', desc: 'Every assignment is written from scratch. Free Turnitin plagiarism report included.' },
      { icon: '⏱️', title: 'On-Time Delivery', desc: '98.2% on-time rate. Need urgent help? We deliver in as little as 3 hours.' },
      { icon: '📚', title: 'University Guidelines', desc: 'We follow your exact rubric, formatting, and citation style no shortcuts.' },
      { icon: '🔄', title: 'Free Revisions', desc: 'Unlimited free revisions until you\'re 100% satisfied with your assignment.' },
      { icon: '🔒', title: 'Confidential & Secure', desc: 'Your identity stays private. SSL-encrypted. Your data is never shared.' }
    ],
    samples: [
      { title: `${subjectInfo.name} Research Paper`, desc: `Comprehensive research paper on a current topic in ${subjectInfo.name} with literature review and methodology.`, tags: ['Research', 'Citations', 'Analysis'], grade: 'HD (88%)' },
      { title: `${subjectInfo.name} Case Study`, desc: `In-depth case study applying ${subjectInfo.name} theories to a real-world scenario with detailed analysis.`, tags: ['Case Study', 'Theory', 'Application'], grade: 'A+ (91%)' },
      { title: `${subjectInfo.name} Final Project`, desc: `End-of-semester project covering core ${subjectInfo.name} concepts with original research and recommendations.`, tags: ['Project', 'Original', 'Research'], grade: 'Distinction (89%)' }
    ],
    faqs: [
      { q: `Do you cover all topics in ${subjectInfo.name}?`, a: `Yes. Our experts cover the entire ${subjectInfo.name} curriculum from foundational concepts to advanced specialized topics. Whether it's an undergraduate assignment or a PhD-level research paper, we have someone qualified to help.` },
      { q: 'Will the work be original and plagiarism-free?', a: 'Absolutely. Every assignment is written from scratch by an expert. We provide a free Turnitin plagiarism report with every order to verify originality.' },
      { q: 'Can you follow my university\'s specific guidelines?', a: 'Yes. Just share your assignment brief, rubric, and any formatting/citation requirements. We follow them exactly including word count, structure, and reference style (APA, MLA, Harvard, Chicago, etc.).' },
      { q: 'What if I need revisions after delivery?', a: 'No problem. We offer unlimited free revisions until you\'re fully satisfied. Just share your feedback and we\'ll refine the work usually within 24 hours.' },
      { q: 'How quickly can you deliver?', a: 'Standard assignments are delivered within 24-72 hours. Urgent orders can be completed in as little as 3 hours. Just tell us your deadline and we\'ll work to meet it.' }
    ],
    pricing: [
      { tier: 'High School', desc: 'Basic level work', price: '7', per: '/page', features: ['Original content', 'Free plagiarism report', 'Free revisions', '24/7 support'] },
      { tier: 'Undergraduate', desc: 'College-level work', price: '10', per: '/page', features: ['Subject-matter PhD expert', 'Premium proofreading', 'Priority support', 'AI-detection-free'] },
      { tier: 'Masters / PhD', desc: 'Research-level work', price: '15', per: '/page', features: ['Top 1% expert', 'Statistical analysis', 'Direct chat with writer', 'Phone support'] }
    ]
  }
}

// Get related subjects (same category, excluding the current one)
export function getRelatedSubjects(currentSlug, limit = 4) {
  const current = allSubjects.find(s => slugify(s.name) === currentSlug)
  if (!current) return []

  return allSubjects
    .filter(s => s.category === current.category && slugify(s.name) !== currentSlug)
    .slice(0, limit)
}
