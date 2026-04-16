import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const controllersDir = path.join(__dirname, 'src', 'controllers');

const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Pattern: OR: [{ mongoId: id }, { id: id }] -> (id.includes('-') ? { id } : { mongoId: id })
  const regex1 = /OR:\s*\[\s*\{\s*mongoId:\s*([a-zA-Z0-9_]+)\s*\}\s*,\s*\{\s*id:\s*\1\s*\}\s*\]/g;
  if (regex1.test(content)) {
    content = content.replace(regex1, "((typeof $1 === 'string' && $1.includes('-')) ? { id: $1 } : { mongoId: $1 })");
    changed = true;
  }

  // Pattern: OR: [{ id }, { mongoId: id }] -> (id.includes('-') ? { id } : { mongoId: id })
  const regex2 = /OR:\s*\[\s*\{\s*([a-zA-Z0-9_]+)\s*\}\s*,\s*\{\s*mongoId:\s*\1\s*\}\s*\]/g;
  if (regex2.test(content)) {
    content = content.replace(regex2, "((typeof $1 === 'string' && $1.includes('-')) ? { id: $1 } : { mongoId: $1 })");
    changed = true;
  }

  // Pattern: OR: [{ id: id }, { mongoId: id }]
  const regex3 = /OR:\s*\[\s*\{\s*id:\s*([a-zA-Z0-9_]+)\s*\}\s*,\s*\{\s*mongoId:\s*\1\s*\}\s*\]/g;
  if (regex3.test(content)) {
    content = content.replace(regex3, "((typeof $1 === 'string' && $1.includes('-')) ? { id: $1 } : { mongoId: $1 })");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Patched ${file}`);
  }
}
console.log("Done");
