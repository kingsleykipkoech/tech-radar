# 2-Minute Demo Video Script & Recording Guide
**Project:** Open Source Tech Radar & Package Health Explorer  
**Course:** ALU Software Engineering — Playing Around with APIs (Summative)  
**Author:** Kingsley Kipkoech (`k.kipkoech@alustudent.com`)  
**Target Duration:** 1 minute 50 seconds (Hard limit: 2 minutes)

---

## Pre-Recording Checklist
- [ ] Local server running (`npm start`) or open live at `http://kingsleykoech.tech`.
- [ ] Browser window sized to clean 1080p (1920x1080) or 16:9 ratio in full screen.
- [ ] Terminal open in side window or split-screen ready to show `curl -I` load balancer headers.
- [ ] Browser zoom set to 100% or 110% for crisp readability.
- [ ] Audio input checked (clear microphone, zero background noise).

---

## Timed Video Script (Second-by-Second)

### 0:00 – 0:25 | Introduction & Problem Statement
* **On Screen:** Full-screen browser showing the Tech Radar homepage with the dark GitHub aesthetic.
* **Spoken Script:**
  > *"Hello everyone! My name is Kingsley Kipkoech, a Software Engineering student at African Leadership University. This is my summative project for 'Playing Around with APIs': the **Open Source Tech Radar and Package Health Explorer**.*
  > 
  > *In modern software development, teams often install packages without knowing if they are actively maintained, secure, or permissively licensed. Tech Radar solves this by aggregating real-time intelligence across the npm and PyPI ecosystems into a single unified health dashboard."*

---

### 0:25 – 0:55 | Live Search, Multi-API Data & Health Score
* **On Screen:** Type `express` into the search bar, click **Analyze**. Hover over the green `90/100` health pill, then click **Inspect Deep Dive** to open the modal.
* **Spoken Script:**
  > *"Let's test it live. I'll search for 'express'. In milliseconds, our backend queries the npm registry, PyPI, and GitHub REST API simultaneously. 
  > 
  > Here we see Express with over 750 million downloads in the last 30 days and an algorithmic Health Score of 90 out of 100. When I open the Deep Dive modal, our custom SVG chart renders the daily download trajectory over the last month, showing adoption velocity alongside its MIT license and GitHub issue debt."*

---

### 0:55 – 1:25 | Interactivity: Multi-Criteria Filtering & Dynamic Sorting
* **On Screen:** Close modal. Click the **PyPI (Python)** filter pill. Search `fastapi`. Change the Sort dropdown to **GitHub Stars (High to Low)**, then switch license filter to **Permissive**.
* **Spoken Script:**
  > *"The application provides rich client-side interactivity to meet all rubric requirements. I can switch ecosystems with one click from Node.js to Python PyPI, search for libraries like FastAPI, and instantly sort results dynamically—whether by GitHub stars, 30-day downloads, or issue debt.
  > 
  > We can also filter strictly by license type, isolating MIT or Apache-permissive packages from copyleft ones to ensure enterprise compliance."*

---

### 1:25 – 1:45 | Distributed Deployment & Load Balancing
* **On Screen:** Point to the top-right cluster telemetry badge (`Node: web-01`), switch to terminal and run `curl -I http://kingsleykoech.tech/api/health` multiple times.
* **Spoken Script:**
  > *"For the deployment rubric, Tech Radar is deployed in a distributed high-availability architecture across ALU servers. Our backend runs on dual nodes—web-01 and web-02—behind HAProxy on lb-01 at kingsleykoech.tech.
  > 
  > As you see on the top badge and in our terminal curl responses, the X-Served-By header alternates dynamically between web-01 and web-02 with automated health checks."*

---

### 1:45 – 1:55 | Conclusion & Sign-Off
* **On Screen:** Show the GitHub repository (`kingsleykipkoech/tech-radar`) with complete documentation and passing tests.
* **Spoken Script:**
  > *"The complete source code, tests, and deployment scripts are available on my GitHub repository. Thank you for watching!"*

---

## Evaluation Rubric Alignment Notes
| Feature Demonstrated | Timestamps | Rubric Criteria | Points Target |
| :--- | :--- | :--- | :--- |
| Public API Integration (GitHub + npm + PyPI) | 0:25 – 0:55 | Functionality: Reputable APIs & Data Extraction | 50% |
| Live Search, Filter & Dynamic Sort | 0:55 – 1:25 | Functionality & UX: Interactivity & Responsive UI | 10% |
| Dual-Server Deployment & HAProxy Telemetry | 1:25 – 1:45 | Deployment: Web-01/02 behind Load Balancer | 20% |
| Production README, Setup & Video Duration | Whole video | Docs & Demo Video (<= 2 min) | 20% |
| **Total Expected Score** | | | **100 / 100** |
