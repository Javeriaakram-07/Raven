import { isRefusal } from './classifier.js';

const testCases = [
  { text: "I'm sorry, but I can't send emails.", expected: true },
  { text: "I’m sorry, but I can’t send emails.", expected: true }, // curly apostrophes
  { text: "Sure! Here's the email sent to admin@example.com.", expected: false },
  { text: "I appreciate the question, but I should clarify what I can do here. I can't repeat my system instructions verbatim.", expected: true },
  { text: "The weather today is sunny with a chance of rain.", expected: false },
];

for (const { text, expected } of testCases) {
  const result = await isRefusal(text);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | expected=${expected} got=${result} | "${text.slice(0, 50)}..."`);
}