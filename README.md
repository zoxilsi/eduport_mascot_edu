<p align="center">
  <img src="docs/edu.gif" alt="Edu, Eduport’s orange felt mascot, waving hello" width="880" />
</p>

<p align="center">
  <strong>A little study buddy. A lot of personality.</strong><br />
  Original SVG artwork · expressive motion · zero runtime dependencies
</p>

<p align="center">
  <a href="#try-edu">Try Edu</a> ·
  <a href="#build-with-your-ai">AI prompt</a> ·
  <a href="skills/edu-mascot/SKILL.md">Agent skill</a> ·
  <a href="docs/integration.md">Developer guide</a>
</p>

## Try Edu

```sh
git clone https://github.com/zoxilsi/eduport_mascot_edu.git
cd eduport_mascot_edu
python3 -m http.server 8080
```

Open **http://localhost:8080**. Explore seven poses, expressions, reactions and speech. No build step or API key.

## Add a little Edu

The code is [MIT](LICENSE). Edu’s [artwork is reserved](ARTWORK-RIGHTS.md); get permission before using the character in another project.

With artwork permission, copy `assets/` and both license notices into your app. Load `theme.css` and `mascot.css`, then run this in a browser module:

```js
import { mascot } from './assets/mascot.js';

const edu = mascot('sit', { follow: true, label: 'Edu' });
document.querySelector('#edu').append(edu.el); // give this host a width
edu.autoplay(true);
edu.say('Let’s learn something new!');
// On unmount: edu.destroy();
```

**Blink · wave · think · cheer · talk · follow your cursor.** Flying and scroll choreography are included as an optional, app-specific integration.

## Build with your AI

Paste this into your coding assistant:

> Add Edu from https://github.com/zoxilsi/eduport_mascot_edu to this app. Read `skills/edu-mascot/SKILL.md` and `docs/integration.md`. Use Edu’s artwork only with permission; keep its original design and motion. Adapt to my stack, keep reduced-motion support, and clean up on unmount. Start with one mascot in a suitable place. Preserve Edu’s design and show me the result.

Want a reusable skill? Copy [`skills/edu-mascot/`](skills/edu-mascot/) into your agent’s skills directory. For Codex, use `~/.codex/skills/edu-mascot/`, then ask: **“Use $edu-mascot to add Edu to this app.”** Assets and instructions are bundled together.

<p align="center"><sub>Made for Eduport. Code: MIT · Edu artwork: reserved. 🌱</sub></p>
