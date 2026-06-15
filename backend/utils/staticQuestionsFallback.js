/**
 * Static Fallback Questions Bank for NeuroHire
 * Used when the OpenRouter LLM service is unavailable, times out, or fails to return valid JSON.
 */

const fallbackCodingQuestions = [
  {
    title: "Two Sum",
    statement: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
    inputFormat: "First line: Array of integers separated by spaces (e.g. '2 7 11 15').\nSecond line: An integer representing the target (e.g. '9').",
    outputFormat: "Two space-separated integers representing the indices.",
    sampleInput: "2 7 11 15\n9",
    sampleOutput: "0 1",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
    difficulty: "medium"
  },
  {
    title: "Valid Parentheses",
    statement: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
    inputFormat: "A single line containing the string of brackets `s`.",
    outputFormat: "The string 'true' if the string is valid, or 'false' otherwise.",
    sampleInput: "()[]{}",
    sampleOutput: "true",
    constraints: "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'",
    difficulty: "medium"
  },
  {
    title: "Merge Sorted Arrays",
    statement: "Given two sorted integer arrays `nums1` and `nums2`, merge `nums2` into `nums1` as one sorted array.\n\nNote: You should return a merged sorted array of elements from both arrays.",
    inputFormat: "First line: Elements of nums1 separated by spaces.\nSecond line: Elements of nums2 separated by spaces.",
    outputFormat: "A single line containing the merged sorted array elements separated by spaces.",
    sampleInput: "1 3 5\n2 4 6",
    sampleOutput: "1 2 3 4 5 6",
    constraints: "1 <= nums1.length, nums2.length <= 1000\n-10^9 <= nums1[i], nums2[j] <= 10^9",
    difficulty: "medium"
  }
];

const rawMcqBank = [
  // Javascript & Web Dev
  { q: "Which of the following is not a reserved word in JavaScript?", o: ["interface", "throws", "program", "short"], c: 2 },
  { q: "What is the output of 'console.log(typeof null)' in JavaScript?", o: ["'null'", "'object'", "'undefined'", "'boolean'"], c: 1 },
  { q: "Which method adds one or more elements to the end of an array and returns the new length?", o: ["pop()", "push()", "shift()", "concat()"], c: 1 },
  { q: "What does HTML stand for?", o: ["Hyper Text Markup Language", "High Text Markup Language", "Hyper Tabular Multi Language", "Hyper Tech Main Link"], c: 0 },
  { q: "Which CSS property controls text size?", o: ["font-style", "text-size", "font-size", "text-style"], c: 2 },
  { q: "What is the purpose of the 'useEffect' hook in React?", o: ["To define global state", "To perform side effects in functional components", "To handle form submissions", "To cache expensive calculations"], c: 1 },
  { q: "Which HTTP status code represents a successful request?", o: ["200 OK", "301 Moved Permanently", "404 Not Found", "500 Internal Server Error"], c: 0 },
  { q: "Which of the following is used to store data in a browser locally that persists even after closing?", o: ["sessionStorage", "cookies", "localStorage", "applicationCache"], c: 2 },
  { q: "What is the virtual DOM in React?", o: ["A direct copy of the HTML DOM", "A lightweight, in-memory representation of the real DOM", "A browser extension", "A styling library"], c: 1 },
  { q: "Which CSS layout model allows easy alignment of items in one dimension?", o: ["Grid", "Flexbox", "Block", "Inline"], c: 1 },
  
  // Python
  { q: "Which of the following is an immutable data type in Python?", o: ["list", "dict", "set", "tuple"], c: 3 },
  { q: "How do you start a comments in Python?", o: ["//", "/*", "#", "<!--"], c: 2 },
  { q: "What is the output of 'print(2 ** 3)' in Python?", o: ["6", "8", "9", "5"], c: 1 },
  { q: "Which keyword is used to define a function in Python?", o: ["func", "def", "function", "define"], c: 1 },
  { q: "What is the output of len([1, 2, 3]) in Python?", o: ["3", "4", "2", "Error"], c: 0 },
  { q: "Which of the following creates a dictionary in Python?", o: ["x = []", "x = ()", "x = {}", "x = set()"], c: 2 },
  { q: "What is the purpose of '__init__' method in Python classes?", o: ["To import classes", "To initialize a newly created object's state", "To destroy objects", "To define static methods"], c: 1 },
  { q: "How do you insert an item at a specific index in a Python list?", o: ["list.add(idx, item)", "list.append(item)", "list.insert(idx, item)", "list.push(idx, item)"], c: 2 },
  { q: "Which of the following is used to catch exceptions in Python?", o: ["try / catch", "try / except", "do / catch", "throw / catch"], c: 1 },
  { q: "What does PEP 8 represent in Python community?", o: ["A Python compiler", "The standard style guide for Python code", "A performance optimization tool", "A package manager"], c: 1 },

  // Data Structures & Algorithms
  { q: "What is the average time complexity of searching in a hash table?", o: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], c: 0 },
  { q: "Which data structure operates on a Last-In, First-Out (LIFO) basis?", o: ["Queue", "Stack", "Heap", "Linked List"], c: 1 },
  { q: "What is the worst-case time complexity of Quick Sort?", o: ["O(n log n)", "O(n)", "O(n^2)", "O(2^n)"], c: 2 },
  { q: "Which algorithm finds the shortest path in a weighted graph with non-negative edge weights?", o: ["Kruskal's", "Dijkstra's", "Prim's", "Bellman-Ford"], c: 1 },
  { q: "A binary search tree has a height of h. What is the search time complexity?", o: ["O(1)", "O(h)", "O(n)", "O(n log n)"], c: 1 },
  { q: "What data structure is typically used to implement Breadth-First Search (BFS)?", o: ["Stack", "Queue", "Priority Queue", "Graph"], c: 1 },
  { q: "Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n)?", o: ["Bubble Sort", "Insertion Sort", "Selection Sort", "Merge Sort"], c: 3 },
  { q: "What is the space complexity of an in-place sorting algorithm?", o: ["O(1)", "O(log n)", "O(n)", "O(n^2)"], c: 0 },
  { q: "In a min-heap, where is the minimum element located?", o: ["At the root leaf", "At the root node", "At the leftmost node", "At the rightmost node"], c: 1 },
  { q: "What is the recurrence relation for Merge Sort?", o: ["T(n) = T(n-1) + O(n)", "T(n) = 2T(n/2) + O(n)", "T(n) = T(n/2) + O(1)", "T(n) = 2T(n/2) + O(1)"], c: 1 },

  // Databases & SQL
  { q: "Which SQL clause is used to filter records after aggregation?", o: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], c: 1 },
  { q: "What does ACID stand for in database transactions?", o: ["Access, Control, Index, Data", "Atomicity, Consistency, Isolation, Durability", "Action, Commit, Integrity, Delivery", "Automatic, Concurrent, Internal, Distributed"], c: 1 },
  { q: "Which constraint uniquely identifies each record in a database table?", o: ["FOREIGN KEY", "UNIQUE KEY", "PRIMARY KEY", "CHECK"], c: 2 },
  { q: "Which database system is classified as a NoSQL document database?", o: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], c: 2 },
  { q: "What is the default port for MySQL?", o: ["5432", "27017", "3306", "8080"], c: 2 },
  { q: "Which SQL join returns all records when there is a match in either left or right table?", o: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], c: 3 },
  { q: "What is the purpose of database indexing?", o: ["To secure database records", "To speed up data retrieval operations", "To compress data storage", "To prevent duplicate entries"], c: 1 },
  { q: "In database design, what prevents redundant data storage?", o: ["Transaction logs", "Normalization", "Sharding", "Clustering"], c: 1 },
  { q: "Which SQL statement is used to remove all records from a table without logging individual row deletions?", o: ["DELETE", "DROP", "TRUNCATE", "REMOVE"], c: 2 },
  { q: "What does SQL stand for?", o: ["Structured Query Language", "Strong Question Language", "Simple Query Language", "Structured Queue Layout"], c: 0 },

  // Git & Software Engineering
  { q: "Which Git command downloads the history from a remote repository but does not merge it?", o: ["git pull", "git fetch", "git clone", "git checkout"], c: 1 },
  { q: "What does 'DRY' stand for in software engineering principles?", o: ["Don't Repeat Yourself", "Do Repeat Yesterday", "Development Readiness Yield", "Data Routing Yield"], c: 0 },
  { q: "Which Git command is used to stage changes for a commit?", o: ["git commit", "git push", "git add", "git status"], c: 2 },
  { q: "What is the purpose of CI/CD pipelines?", o: ["To design wireframes", "To automate code building, testing, and deployment", "To write API documentation", "To handle database backups"], c: 1 },
  { q: "In agile development, what is a 'Sprint'?", o: ["A physical race between developers", "A fixed time-box during which specific work is completed", "A daily standup meeting", "A codebase release"], c: 1 },
  { q: "Which Git command shows the commit history?", o: ["git log", "git diff", "git show", "git status"], c: 0 },
  { q: "What is the SOLID design principle 'S' referring to?", o: ["Single Responsibility Principle", "System Design Principle", "Software Safety Principle", "Synchronous Loop Principle"], c: 0 },
  { q: "Which command creates a new Git branch and switches to it instantly?", o: ["git branch <name>", "git checkout -b <name>", "git merge <name>", "git switch <name>"], c: 1 },
  { q: "What does a 'RESTful API' leverage for communication?", o: ["WebSockets", "HTTP methods", "gRPC", "GraphQL"], c: 1 },
  { q: "What is the main role of a linting tool (e.g. ESLint)?", o: ["To compile code", "To analyze code for potential errors and styling issues", "To run tests", "To deploy applications"], c: 1 }
];

/**
 * Generate 100 MCQs statically by repeating/mutating the question pool to match requested jobId.
 * Returns array of exactly 100 objects.
 */
function getStaticMcqPool(jobTitle = "Software Engineer", skills = []) {
  const list = [];
  const skillsStr = skills.join(", ") || "development";
  
  // Clone and adapt basic 50 questions
  for (let i = 0; i < 100; i++) {
    const original = rawMcqBank[i % rawMcqBank.length];
    
    // Add variations to make all 100 unique
    let questionText = original.q;
    if (i >= rawMcqBank.length) {
      questionText = `[Ref: ${jobTitle}] ${original.q} (Variation ${Math.floor(i / rawMcqBank.length)})`;
    }
    
    list.push({
      questionText: questionText,
      options: [...original.o],
      correctIndex: original.c
    });
  }
  return list;
}

/**
 * Get 3 static coding problems.
 */
function getStaticCodingProblems() {
  return [...fallbackCodingQuestions];
}

module.exports = {
  getStaticMcqPool,
  getStaticCodingProblems
};
