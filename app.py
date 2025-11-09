import flask
from flask import request, jsonify
from flask_cors import CORS
import sqlite3
import threading
import time
import uuid
import json
import os 
import google.generativeai as genai 
import re 

# --- Flask App Setup ---
app = flask.Flask(__name__)
CORS(app)

# ---
# --- 🚀 DEBUG MODE SWITCH 🚀 ---
# ---
USE_DEBUG_DATA = False
# ---

# --- Sample Data for Debugging (Updated) ---
# 2. NEW: Debug data is now a JSON object with "summary" and "fullReport"
DEBUG_REPORT_JSON = {
    "summary": """
# Project Dashboard: AI Meal Planner

### Key Statistics
- **Total Budget:** $500,000 - $615,000
- **Total Timeline:** 35 Weeks
- **Key Goal (Adoption):** 15,000 Users in 6 Months
- **Key Goal (Utility):** $40/mo Average User Savings
- **Critical Path:** 3.0 Core AI/ML Dev (8 Weeks)

### Actionable Insights
1.  **High-Impact Risk:** The project's success is critically dependent on securing reliable, real-time grocery sales data. This data pipeline (WBS 3.0) is the main risk and must be validated immediately.
2.  **Budget Allocation:** The budget has been revised to allocate $200,000 (over 35% of the total) to WBS 3.0, reflecting its high priority and complexity.
3.  **Go-to-Market:** The timeline for WBS 6.0 (Go-to-Market) has been extended to 6 weeks to properly support the aggressive user acquisition goal of 15,000 users.
4.  **Metric Verification:** A new QA task, "Metric Verification Study," has been added to ensure the internal AI accuracy score directly correlates with the external goal of $40 in user savings.
""",
    "fullReport": """
# AI Meal Planner App: Comprehensive Project Plan

## 1. Executive Summary
**Reasoning**
This section provides a high-level overview of the project's purpose, scope, and key success metrics, establishing the context for executive stakeholders. The core value proposition—using AI to link dietary needs with real-time local grocery sales—is identified as the primary differentiator.

The AI Meal Planner App project aims to deliver a novel solution to help busy professionals and families adhere to healthier eating habits while simultaneously reducing food costs. The core unique selling proposition (USP) is the integration of personalized nutritional planning with real-time, localized grocery store sales data.

The project is estimated to take approximately **35 total weeks** from initiation to post-launch monitoring, with a total budget ranging from **$500,000 to $615,000**. Critical success hinges on the accurate development of the core AI/ML model (WBS 3.0) and aggressive user acquisition strategies post-launch.

Key success metrics include achieving 15,000 registered users within six months and demonstrating an average documented user savings of $40 per month, directly validating the AI's cost-optimization feature.

## 2. Project Goals & Objectives (SMART)
**Reasoning**
The objectives are defined using the SMART framework (Specific, Measurable, Achievable, Relevant, Time-bound) to ensure clarity and accountability. These goals focus on both business growth (user adoption, conversion) and core utility (savings, satisfaction).

The following SMART goals govern the project’s success criteria:
- **User Adoption & Scale:** Achieve a milestone of **15,000 registered users** and **6,000 monthly active users (MAUs)** within the first six months post-launch.
- **Utility Verification:** Document and communicate an average user grocery savings of **$40 per month**, verified by user surveys and internal metrics, within the first quarter of full operation (Q1).
- **User Satisfaction:** Maintain a user satisfaction score (CSAT) of **4.5/5.0 or higher** regarding the relevance and health adherence of generated meal plans throughout the first 120 days post-launch.
- **Monetization:** Establish a subscription conversion rate of **8% or higher** among users completing the 14-day free trial period by the end of the second fiscal quarter.

### User Adoption Goal (First 6 Months)
<canvas id="userGrowthChart"
 data-chart-type="line"
 data-chart-title="User Adoption Goal (First 6 Months)"
 data-chart-labels='["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"]'
 data-chart-values='[1000, 2500, 5000, 8000, 12000, 15000]'>
</canvas>


## 3. Market & Competitor Analysis
**Reasoning**
Analyzing the competitive landscape identifies existing market gaps and informs the necessary feature set for the AI Meal Planner App to achieve differentiation. The primary gap identified is the lack of real-time, localized sales integration among existing leaders.

| Competitor | Primary Strength | Strategic Implication for AI Planner App |
| :--- | :--- | :--- |
| **eMeals** | Highly structured, subscription-based meal plans tailored to specific diets and lifestyles, simplifying the entire weekly planning process. | Must offer comparable structure and adherence features, but with superior personalization and dynamic cost optimization. |
| **Paprika** | Robust cross-platform recipe management and organization tools for saving and syncing personal collections. | Must prioritize seamless import/export functionality and robust user-generated content tools to minimize user switching costs. |
| **Yummly** | Leverages a massive, aggregated recipe database with advanced personalization algorithms for superior recipe discovery. | Requires securing early licensing agreements for a high-quality recipe database and focusing AI development on superior utility (cost/health) rather than sheer volume. |

## 4. Project Scope & Work Breakdown Structure (WBS)
**Reasoning**
The scope outlines the boundaries of the project, focusing on the development of the core AI engine, data infrastructure, and user-facing application. The WBS breaks down the total effort into seven manageable phases, while user stories define the functional requirements from the end-user perspective.

### Work Breakdown Structure (WBS)
| ID | Task |
| :--- | :--- |
| 1.0 | Project Initiation, Scope Definition, and Monetization Strategy |
| 2.0 | System Architecture and UX/UI Design |
| 3.0 | Core AI/ML Model Development and Data Pipeline Establishment |
| 4.0 | Application Development (Frontend, Backend, and Subscription Flow) |
| 5.0 | Quality Assurance, Compliance, and Beta Testing |
| 6.0 | Go-to-Market Strategy, Launch Execution, and User Acquisition |
| 7.0 | Post-Launch Monitoring, Growth Hacking, and Metric Verification |

### Key Functional Requirements
| ID | Requirement | Acceptance Criteria |
| :--- | :--- | :--- |
| **FR-01** | The user must be able to generate personalized recommendations based on their profile. | Profile setup wizard completion, generation of initial output within 5 seconds, recommendations dynamically update based on profile changes. |
| **FR-02** | The user must be able to seamlessly upgrade to a premium account. | Successful payment processing via multiple methods (credit card, PayPal), immediate account status update to 'Premium', clear differentiation between free and paid features. |
| **FR-03** | The user must be able to interact with a clean and intuitive dashboard. | Key metrics visible on the main screen, navigation accessible on all pages, average time-to-task completion under 10 seconds. |
| **FR-04** | The user must be able to manage their personal data and account settings. | Implementation of industry-standard security protocols (e.g., encryption), clear GDPR/CCPA compliant data deletion process accessible via the settings menu. |

## 5. Visual Timeline & Milestones
**Reasoning**
The timeline confirms a **35-week development cycle**, highlighting that the Core AI/ML Model Development (WBS 3.0) is the longest and most critical path component. The Go-to-Market phase (WBS 6.0) has been extended to 6 weeks to properly support user acquisition goals.

### Key Project Milestones
- **Milestone 1:** Project Scope and Monetization Strategy Lock (Phase Gate Approval)
- **Milestone 2:** System Architecture and Final UX/UI Design Approved (Technical Blueprint Complete)
- **Milestone 3:** Feature Complete Alpha Version Deployed (Core AI Integrated and Functional)
- **Milestone 4:** Successful Public Production Launch

### Projected High-Level Timeline (Gantt Chart)
<div class="gantt-chart-container">
    <table class="gantt-chart">
        <thead>
            <tr>
                <th>Task (WBS)</th>
                <th colspan="4">Weeks 1-4</th>
                <th colspan="4">Weeks 5-8</th>
                <th colspan="4">Weeks 9-12</th>
                <th colspan="4">Weeks 13-16</th>
                <th colspan="4">Weeks 17-20</th>
                <th colspan="4">Weeks 21-24</th>
                <th colspan="4">Weeks 25-28</th>
                <th colspan="4">Weeks 29-32</th>
                <th colspan="4">Weeks 33-36</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1.0 Initiation</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="1" data-duration="4" data-label="4 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>2.0 Architecture</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="5" data-duration="4" data-label="4 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>3.0 Core AI/ML Dev</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="9" data-duration="8" data-label="8 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>4.0 App Dev</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="17" data-duration="6" data-label="6 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>5.0 QA & Beta</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="23" data-duration="4" data-label="4 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>6.0 Go-to-Market</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="27" data-duration="6" data-label="6 Weeks"></span>
                </td>
            </tr>
            <tr>
                <td>7.0 Post-Launch</td>
                <td colspan="36" class="gantt-row">
                    <span data-start-week="33" data-duration="3" data-label="3 Weeks"></span>
                </td>
            </tr>
        </tbody>
    </table>
</div>


## 6. Budget & Resource Plan
**Reasoning**
The budget allocation reflects the technical complexity of the project. The budget for WBS 3.0 (Core AI/ML) has been increased to account for complex data pipeline development. The total budget is now **$500,000 - $615,000**. A 15% contingency buffer is allocated to manage identified risks.

### Budget Allocation
<canvas id="budgetChart"
 data-chart-type="horizontalBar"
 data-chart-title="Budget Allocation (Est: $550k)"
 data-chart-labels='["1.0 Initiation", "2.0 Architecture", "3.0 Core AI/ML (Rev)", "4.0 App Dev", "5.0 QA", "6.0 Go-to-Market", "7.0 Post-Launch", "Contingency"]'
 data-chart-values='[40000, 50000, 200000, 100000, 35000, 50000, 10000, 65000]'>
</canvas>

## 7. Risk Analysis & Mitigation
**Reasoning**
A proactive risk strategy is essential, focusing heavily on the reliability of the core AI functionality and the complex task of securing high-quality data (recipes and real-time sales). Mitigation strategies prioritize architectural flexibility and early content acquisition.

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Localized Data Dependency** | **High** | The plan must include a formal discovery phase (WBS 1.1) to confirm the legal and technical feasibility of acquiring real-time, multi-vendor grocery data. |
| **AI Planning Algorithm Failure** | High | Establish strict KPIs for planning accuracy (e.g., adherence to caloric/macro goals) and run extensive beta testing focusing on real-world feasibility (ingredient cost, prep time, variety) before launch. |
| **Recipe Database Acquisition** | High | Prioritize securing early licensing agreements with key content providers and focus development resources on robust user-generated content tools to rapidly expand the database organically. |
| **Low User Adoption** | Medium-High | Prioritize seamless import/export functionality (e.g., common recipe file formats, web scraping tools) and ensure compatibility with popular third-party grocery list and calendar applications. |
| **AI Model Obsolescence** | Medium | Design the AI architecture to be modular and decoupled from the main application logic, allowing for rapid iteration and replacement of underlying models. |

## 8. Quality Assurance & Control
**Reasoning**
This section confirms the commitment to system performance, security, and process integrity. The QA targets are directly linked to the SMART goals and user stories, while the communication plan ensures stakeholder alignment.

### Quality Assurance (QA) Targets
| Metric | Target | Link to Goal/Story |
| :--- | :--- | :--- |
| System Availability (Uptime) | 99.9% or higher during peak hours. | Technical Resilience |
| Core Function Latency | Median load time < 3.0s (P95 < 5.0s). | FR-01 |
| Subscription Flow Success | 99.5% success rate for payment processing. | Goal 4, FR-02 |
| AI Recommendation Accuracy | Internal QA score of 90% or higher. | Goal 2 |
| **Metric Verification Study** | **Pilot program to correlate internal QA score with external $40 user savings.** | **Goal 2** |
| User Satisfaction (CSAT) | 4.5/5.0 or higher re: meal plan relevance. | Goal 3 |
| Security Vulnerability | Zero critical/high-severity vulnerabilities in prod. | FR-04 |

### Communications Plan
| Stakeholder | Frequency | Method | Purpose |
| :--- | :--- | :--- | :--- |
| Executive Leadership | Bi-weekly | Exec. Summary & 15-min Check-in | Review milestones, budget, and critical risks. |
| General User Base | Monthly | Newsletter / In-App Notification | Provide utility updates, demonstrate value, and share tips. |
| Power Users (Fitness) | Weekly | Social Channel & Targeted Email | Share deep-dive features, training content, and gather feedback. |
| Media & PR | As Needed | Press Release / Media Advisory | Control narrative for major launches or partnerships. |

### Change Control Process
1.  **Submit Change Request (CR):** A formal request detailing the proposed modification, its priority, and its business justification.
2.  **CCB Analysis:** The Change Control Board (CCB) analyzes the CR's impact on the project baseline and core AI functionality.
3.  **Decision & Documentation:** Approve, Reject, or Defer the CR. All approved changes are documented, the project plan is updated, and the change is scheduled for implementation.
"""
}

# --- Database Setup ---
DATABASE_NAME = "jobs.db"

def get_db():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates the database table if it doesn't exist."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            job_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            current_task TEXT,
            form_data TEXT,
            final_report TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        db.commit()

# --- Gemini API Setup ---
try:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    genai.configure(api_key=api_key)
    generation_config = {"temperature": 0.7, "top_p": 1, "top_k": 1, "max_output_tokens": 8192}
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-preview-09-2025",
        generation_config=generation_config,
        safety_settings=safety_settings
    )
    print("Gemini API client initialized successfully.")
except (KeyError, ValueError) as e:
    print(f"Error initializing Gemini: {e}")
    print("Please set your GEMINI_API_KEY environment variable.")
    model = None

# --- JSON Parsing Helper ---
def clean_json_response(text):
    """Cleans the model's text output to get a valid JSON string."""
    start_match = re.search(r'[\{\[]', text)
    end_match = re.search(r'[\}\]]', text[::-1]) 
    if not start_match or not end_match:
        raise ValueError("No valid JSON object or array found in the response.")
    start_index = start_match.start()
    end_index = len(text) - end_match.start()
    json_str = text[start_index:end_index]
    json_str = json_str.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"Failed to decode JSON: {e}")
        print(f"Raw text was: {text}")
        print(f"Cleaned string was: {json_str}")
        raise ValueError(f"Invalid JSON response from model: {e}")

# --- AI Agent Definitions (ALL 15 AGENTS) ---

def agent_chief_strategist(form_data):
    """Agent 1: Defines SMART goals."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Chief Strategist. Analyze the project brief and define 3-5 SMART goals.
    PROJECT BRIEF:
    - Name: {form_data.get('name')}
    - Purpose: {form_data.get('purpose')}
    - Audience: {form_data.get('audience')}
    Return *only* a JSON list of strings.
    Example: ["Achieve 10,000 active users within 6 months post-launch."]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_market_analyst(form_data):
    """Agent 2: Analyzes competitors."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Market Analyst. Analyze the user's known competitors and provide a 1-sentence summary of their primary strength, based on your existing knowledge.
    KNOWN COMPETITORS: {form_data.get('competitors')}
    Return *only* a JSON object mapping the competitor to their strength.
    Example: {{"Glassdoor": "Strong brand recognition and user-generated salary data."}}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_solutions_architect(form_data, smart_goals):
    """Agent 3: Creates the Work Breakdown Structure (WBS)."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Solutions Architect. Create a high-level Work Breakdown Structure (WBS) to achieve the project's SMART goals.
    PROJECT NAME: {form_data.get('name')}
    SMART GOALS: {json.dumps(smart_goals)}
    Return *only* a JSON list of main phases. Each phase must have an "id", a full "task" name, and a "short_name" (max 3 words) for charts.
    Example: [
        {{"id": "1.0", "task": "Phase 1: Discovery & Project Planning", "short_name": "1.0 Planning"}},
        {{"id": "2.0", "task": "Phase 2: UI/UX Design and Prototyping", "short_name": "2.0 Design"}},
        {{"id": "3.0", "task": "Phase 3: Core AI & Backend Development", "short_name": "3.0 Backend Dev"}}
    ]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_product_owner(wbs):
    """Agent 4: Drafts Functional Requirements."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    # 3. NEW PROMPT: Changed from User Stories to Requirements
    prompt = f"""
    You are the Product Owner. Based on the WBS, draft 3-5 high-level functional requirements in the format "The user must be able to..."
    WBS: {json.dumps(wbs)}
    Return *only* a JSON list of requirement objects.
    Example: [
        {{"id": "FR-01", "requirement": "The user must be able to generate personalized meal plans based on their dietary profile.", "criteria": "Profile includes allergies, diet preferences, and calorie goals."}},
        {{"id": "FR-02", "requirement": "The user must be able to view local grocery sales related to their meal plan.", "criteria": "App must integrate with at least 3 major grocery chains."}}
    ]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_project_scheduler(wbs):
    """Agent 5: Defines Key Milestones AND a simple timeline."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Project Scheduler. Based on the WBS, define 3-4 key milestones AND a timeline estimate (in weeks) for each WBS task.
    WBS: {json.dumps(wbs)}
    
    Return *only* a JSON object with two keys: "milestones" and "timeline".
    The timeline should be a list of objects using the "short_name" from the WBS, plus "start_week" and "duration_weeks".
    Example: {{
        "milestones": {{
            "Milestone 1": "Completion of UI/UX Design & Prototyping",
            "Milestone 2": "Alpha version with core features deployed"
        }},
        "timeline": [
            {{"task": "1.0 Planning", "start_week": 1, "duration_weeks": 3}},
            {{"task": "2.0 Design", "start_week": 4, "duration_weeks": 4}},
            {{"task": "3.0 Backend Dev", "start_week": 8, "duration_weeks": 8}}
        ]
    }}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_growth_planner(smart_goals):
    """Agent 5.5: Creates user adoption forecast."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Growth Planner. Based on the SMART goals, create a 6-month user adoption forecast.
    SMART GOALS: {json.dumps(smart_goals)}
    Return *only* a JSON object with two keys: "labels" (a list of 6 months) and "values" (a list of 6 numbers).
    Example: {{
        "labels": ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"],
        "values": [1000, 2500, 5000, 8000, 12000, 15000]
    }}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)


def agent_finance_manager(form_data, wbs):
    """Agent 6: Creates a high-level budget estimate."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Finance & Resource Manager. Create a high-level estimated budget breakdown based on the WBS.
    PROJECT NAME: {form_data.get('name')}
    WBS: {json.dumps(wbs)}
    Return *only* a JSON object with a total and breakdown. The breakdown should use the "short_name" from the WBS. The "cost" must be a number.
    Add one final item for "Contingency (15%)".
    Example: {{
        "totalEstimate": "$30,000 - $45,000",
        "breakdown": [
            {{"item": "1.0 Planning", "cost": 5000}},
            {{"item": "2.0 Design", "cost": 10000}},
            {{"item": "3.0 Backend Dev", "cost": 15000}},
            {{"item": "Contingency (15%)", "cost": 4500}}
        ]
    }}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_risk_analyst(form_data, competitor_analysis):
    """Agent 7: Identifies risks."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Risk Analyst. Based on the project brief and competitor analysis, identify the top 3-4 potential risks.
    PROJECT NAME: {form_data.get('name')}
    COMPETITORS: {json.dumps(competitor_analysis)}
    Return *only* a JSON list of risk objects.
    Example: [
        {{"risk": "Scope creep from undefined features", "impact": "High", "mitigation": "Establish a formal change control process."}}
    ]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_communications_lead(form_data):
    """Agent 8: Plans stakeholder communication."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Communications Lead. Create a simple communication plan for key stakeholders.
    AUDIENCE: {form_data.get('audience')}
    Return *only* a JSON list of communication items.
    Example: [
        {{"stakeholder": "Project Sponsor", "frequency": "Bi-weekly", "method": "Email Update", "purpose": "Budget and milestone review."}}
    ]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_quality_assurance_lead(smart_goals, requirements):
    """Agent 9: Defines high-level QA plan."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    # 3. NEW PROMPT: Takes 'requirements' instead of 'user_stories'
    prompt = f"""
    You are the QA Lead. Define a high-level quality plan based on the goals and functional requirements.
    GOALS: {json.dumps(smart_goals)}
    REQUIREMENTS: {json.dumps(requirements)}
    Return *only* a JSON list of key quality metrics.
    Example: [
        {{"metric": "App Store Rating", "target": "> 4.5 stars"}},
        {{"metric": "Requirement Acceptance", "target": "100% of criteria met for all FRs."}}
    ]
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_change_control(form_data):
    """Agent 10: Establishes a change control process."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    prompt = f"""
    You are the Change Control Agent. Define a simple, 3-step change control process for this project.
    PROJECT NAME: {form_data.get('name')}
    Return *only* a JSON object outlining the process.
    Example: {{
        "step1": "Submit a formal Change Request (CR) document.",
        "step2": "Review CR for impact on budget, schedule, and scope.",
        "step3": "Approve or deny CR. All approved changes are added to the backlog."
    }}
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

def agent_qa_critic(council_results):
    """Agent 11: Reviews all previous outputs for conflicts."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    
    all_outputs_summary = json.dumps(council_results, indent=2)
    
    prompt = f"""
    You are the QA Critic. Your job is to review the *entire* plan generated by the other agents for any obvious conflicts, gaps, or misalignments.
    
    FULL PLAN:
    {all_outputs_summary}
    
    Analyze the plan. Are there any major conflicts? (e.g., "The budget seems too low for the WBS" or "A key risk was missed").
    Return *only* a JSON list of strings, with your findings. **If no conflicts are found, return an empty list.**
    Example of findings: [
        "Finding: The budget for '$25k-$40k' appears low for a WBS that includes 'Phase 3: Development' without more scoping. This is a potential risk.",
        "Finding: The QA plan targets a 4.5-star rating, which aligns well with the SMART goals."
    ]
    Example of no findings: []
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)

# 1. --- NEW AGENT 12: EXECUTIVE SUMMARIZER ---
def agent_executive_summarizer(council_results):
    """Agent 12: Writes the statistics-heavy summary for the dashboard."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    
    summary_data = json.dumps(council_results, indent=2)
    
    prompt = f"""
    You are an Executive Summarizer. Your job is to create a text-only summary for a project dashboard.
    This summary must be concise, statistics-heavy, and focused on actionable insights.
    DO NOT include any graphs, charts, or markdown tables. Use bullet points for lists.
    
    FULL PLAN DATA:
    {summary_data}
    
    Return *only* a Markdown string for the summary.
    
    Example:
    # Project Dashboard: [Project Name]
    
    ### Key Statistics
    - **Total Budget:** [Total Estimate, e.g., "$500k - $615k"]
    - **Total Timeline:** [Total weeks, e.g., "35 Weeks"]
    - **Key Goal (Adoption):** [e.g., "15,000 Users in 6 Months"]
    - **Key Goal (Utility):** [e.g., "$40/mo Average User Savings"]
    - **Critical Path:** [e.g., "3.0 Core AI/ML Dev (8 Weeks)"]
    
    ### Actionable Insights
    1.  **High-Impact Risk:** The project's success is critically dependent on [Most important risk...].
    2.  **Budget Allocation:** The budget has been revised to allocate [$$$] (over X%) to [WBS Task...].
    3.  **Go-to-Market:** The timeline for [WBS Task] has been extended to [X weeks] to support [SMART Goal...].
    """
    response = model.generate_content(prompt)
    return response.text

def agent_reviser(council_results, qa_findings):
    """Agent 13: Attempts to fix the plan based on the Critic's findings."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    
    plan_json = json.dumps(council_results, indent=2)
    findings_json = json.dumps(qa_findings, indent=2)

    prompt = f"""
    You are the Project Reviser. Your job is to fix a project plan that was rejected by the QA Critic.
    You will receive the full plan as a JSON object and a list of the Critic's findings.
    
    Your task is to return a *new, complete, and fixed* JSON object for the *entire plan*.
    You must address all the findings. For example, if the budget is too low, increase the cost of the relevant WBS items and the total estimate. If the timeline is too short, increase the 'duration_weeks' for that task.
    
    Do NOT just return the changed parts. Return the *entire, new, fixed plan* in the same JSON structure as the original.
    
    ORIGINAL PLAN (JSON):
    {plan_json}
    
    CRITIC'S FINDINGS (JSON LIST):
    {findings_json}
    
    Return *only* the new, fixed JSON object for the entire plan.
    """
    response = model.generate_content(prompt)
    return clean_json_response(response.text)
    

def agent_report_synthesizer(council_results):
    """Agent 14: Assembles the final report, including chart data."""
    if not model: raise EnvironmentError("GEMINI_API_KEY is not configured.")
    
    # --- 1. Extract data for charts (using new short_names) ---
    try:
        budget_labels = [item['item'] for item in council_results.get('budget', {}).get('breakdown', [])]
        budget_values = [item['cost'] for item in council_results.get('budget', {}).get('breakdown', [])]
    except Exception:
        budget_labels = []
        budget_values = []

    try:
        timeline_data = council_results.get('scheduler_output', {}).get('timeline', [])
    except Exception:
        timeline_data = []

    try:
        growth_data = council_results.get('user_growth', {})
        user_growth_labels = growth_data.get('labels', [])
        user_growth_values = growth_data.get('values', [])
    except Exception:
        user_growth_labels = []
        user_growth_values = []

    # --- 2. Create the HTML/Canvas tags to be injected ---
    
    # User Growth Chart (Line)
    user_growth_chart_html = f"""
    <canvas id="userGrowthChart"
     data-chart-type="line"
     data-chart-title="User Adoption Goal (First 6 Months)"
     data-chart-labels='{json.dumps(user_growth_labels)}'
     data-chart-values='{json.dumps(user_growth_values)}'>
    </canvas>
    """
    
    # Budget Chart (horizontalBar)
    budget_chart_html = f"""
    <canvas id="budgetChart"
     data-chart-type="horizontalBar"
     data-chart-title="Budget Allocation"
     data-chart-labels='{json.dumps(budget_labels)}'
     data-chart-values='{json.dumps(budget_values)}'>
    </canvas>
    """
    
    # --- GANTT CHART HTML ---
    gantt_html = '<div class="gantt-chart-container">\n<table class="gantt-chart">\n<thead>\n<tr>\n<th>Task (WBS)</th>'
    total_weeks = 36
    for i in range(1, 10):
        gantt_html += f'<th colspan="4">Weeks {(i-1)*4+1}-{i*4}</th>'
    gantt_html += '\n</tr>\n</thead>\n<tbody>\n'
    
    for item in timeline_data:
        task_name = item.get('task', 'Unnamed Task')
        start = item.get('start_week', 1)
        duration = item.get('duration_weeks', 1)
        full_task_name = next((wbs_item['task'] for wbs_item in council_results.get('wbs', []) if wbs_item['short_name'] == task_name), task_name)
        
        gantt_html += f'<tr>\n<td>{full_task_name}</td>\n'
        gantt_html += f'<td colspan="{total_weeks}" class="gantt-row">\n'
        gantt_html += f'    <span data-start-week="{start}" data-duration="{duration}" data-label="{duration} Weeks"></span>\n'
        gantt_html += '</td>\n</tr>\n'
        
    gantt_html += '</tbody>\n</table>\n</div>'


    # --- 3. Construct the Final Prompt for the Synthesizer ---
    all_outputs_summary = json.dumps(council_results, indent=2)
    prompt = f"""
    You are the Report Synthesizer, a professional project manager and technical writer.
    Your final task is to take all the JSON data generated by the other AI agents and write a single, comprehensive, and human-readable project plan.
    
    The output MUST be a single **Markdown** document.
    
    - Add a narrative "reasoning" section for each part.
    - Format lists, tables (WBS, Risks, QA, Comms), and quotes to be easy to read.
    - **Use the full 'task' names** in the WBS Markdown table (from the `wbs` object).
    - **Use the full 'requirement' text** in the Functional Requirements table.
    - Convert the list of risks into a Markdown table.
    
    - **IMPORTANT**: Embed the following HTML blocks EXACTLY as provided, in the correct sections:
    
    1.  **Under the SMART Goals:**
        {user_growth_chart_html}

    2.  **For the "Visual Timeline & Milestones" section:**
        {gantt_html}
    
    3.  **For the "Budget & Resource Plan" section:**
        {budget_chart_html}
    
    - Include placeholder sources, like `[Source: Gartner, 2025]`.
    - **DO NOT** include a "QA Critic's Findings" section. The plan is final.
    - **DO NOT** include "(Revised)" in the main title.
    
    COUNCIL DATA (JSON):
    {all_outputs_summary}
    
    ---
    (Begin Markdown Report)
    ---
    """
    response = model.generate_content(prompt)
    return response.text


# --- AI Council (Main Background Job) ---
def run_ai_council_job(job_id, form_data_json):
    """
    Runs the full AI council, including revision loops.
    This runs in a background thread.
    """
    
    if USE_DEBUG_DATA:
        print("--- RUNNING IN DEBUG MODE ---")
        print("--- SKIPPING ALL AI AGENTS ---")
        update_job_status(job_id, "processing", "Loading debug data...")
        db = get_db()
        cursor = db.cursor()
        # 2. NEW: Save the debug JSON object as a string
        cursor.execute(
            "UPDATE jobs SET status = ?, final_report = ? WHERE job_id = ?",
            ('complete', json.dumps(DEBUG_REPORT_JSON), job_id)
        )
        db.commit()
        print("--- Injected debug data and marked job as complete. ---")
        return
    
    council_results = {}
    RATE_LIMIT_DELAY = 7 # in seconds
    
    try:
        form_data = json.loads(form_data_json)
        council_results["initialBrief"] = form_data
        
        revision_setting = form_data.get("revision_rounds", "until-good")
        if revision_setting == "1":
            MAX_REVISIONS = 0
        elif revision_setting == "2":
            MAX_REVISIONS = 1
        elif revision_setting == "3":
            MAX_REVISIONS = 2
        else: # "until-good"
            MAX_REVISIONS = 3 # Safe cap
        
        revision_count = 0

        while revision_count <= MAX_REVISIONS:
            
            # --- Run Agents 1-10 ---
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 1/13: Running Chief Strategist...")
            council_results["smartGoals"] = agent_chief_strategist(form_data)
            time.sleep(RATE_LIMIT_DELAY) 

            update_job_status(job_id, "processing", f"[Rev {revision_count}] 2/13: Running Market Analyst...")
            council_results["competitorAnalysis"] = agent_market_analyst(form_data)
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 3/13: Running Solutions Architect...")
            council_results["wbs"] = agent_solutions_architect(form_data, council_results["smartGoals"])
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 4/13: Running Product Owner...")
            # 3. UPDATED: Changed key to 'requirements'
            council_results["requirements"] = agent_product_owner(council_results["wbs"])
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 5/13: Running Project Scheduler...")
            council_results["scheduler_output"] = agent_project_scheduler(council_results["wbs"])
            time.sleep(RATE_LIMIT_DELAY) 

            update_job_status(job_id, "processing", f"[Rev {revision_count}] 6/13: Running Growth Planner...")
            council_results["user_growth"] = agent_growth_planner(council_results["smartGoals"])
            time.sleep(RATE_LIMIT_DELAY)

            update_job_status(job_id, "processing", f"[Rev {revision_count}] 7/13: Running Finance Manager...")
            council_results["budget"] = agent_finance_manager(form_data, council_results["wbs"])
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 8/13: Running Risk Analyst...")
            council_results["risks"] = agent_risk_analyst(form_data, council_results["competitorAnalysis"])
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 9/13: Running Communications Lead...")
            council_results["communicationsPlan"] = agent_communications_lead(form_data)
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 10/13: Running QA Lead...")
            # 3. UPDATED: Pass 'requirements'
            council_results["qaPlan"] = agent_quality_assurance_lead(council_results["smartGoals"], council_results["requirements"])
            time.sleep(RATE_LIMIT_DELAY)
            
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 11/13: Running Change Control...")
            council_results["changeControlPlan"] = agent_change_control(form_data)
            time.sleep(RATE_LIMIT_DELAY) 

            # --- Run Agent 11: The Critic ---
            update_job_status(job_id, "processing", f"[Rev {revision_count}] 12/13: Running QA Critic...")
            qa_findings = agent_qa_critic(council_results)
            time.sleep(RATE_LIMIT_DELAY)
            
            if not qa_findings:
                print(f"--- QA Critic approved plan on revision {revision_count}. ---")
                break 
            
            revision_count += 1
            if revision_count > MAX_REVISIONS:
                print(f"--- Max revisions reached. Accepting plan with findings. ---")
                council_results["qaCriticFindings"] = qa_findings
                break 
                
            print(f"--- QA Critic found issues. Starting revision {revision_count}... ---")
            update_job_status(job_id, "processing", f"QA found issues. Revising... (Attempt {revision_count})")
            
            # --- Run Agent 13: The Reviser ---
            council_results = agent_reviser(council_results, qa_findings)
            time.sleep(RATE_LIMIT_DELAY)
            
        # --- End of while loop ---

        # --- Run Agent 12 (Summary) & 14 (Full Report) ---
        update_job_status(job_id, "processing", "13/14: Generating Executive Summary...")
        summary_markdown = agent_executive_summarizer(council_results)
        time.sleep(RATE_LIMIT_DELAY)
        
        update_job_status(job_id, "processing", "14/14: Generating Full Report...")
        full_report_markdown = agent_report_synthesizer(council_results)
        
        # 2. NEW: Create final JSON object
        final_report_object = {
            "summary": summary_markdown,
            "fullReport": full_report_markdown
        }
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE jobs SET status = ?, final_report = ? WHERE job_id = ?",
             # 2. NEW: Save the JSON object as a string
            ('complete', json.dumps(final_report_object), job_id) 
        )
        db.commit()
        print(f"--- Job {job_id} complete. Final report saved. ---")

    except Exception as e:
        print(f"Error in job {job_id}: {e}")
        error_message = f"Job failed: {str(e)}. Check server logs."
        update_job_status(job_id, "failed", error_message)

def update_job_status(job_id, status, current_task):
    """Helper function to update the job's status in the database."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "UPDATE jobs SET status = ?, current_task = ? WHERE job_id = ?",
        (status, current_task, job_id)
    )
    db.commit()


# --- API Endpoint 1: Create Project (Starts the Job) ---
@app.route("/api/v1/create-project", methods=["POST"])
def create_project():
    form_data = request.json
    job_id = str(uuid.uuid4())
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO jobs (job_id, status, current_task, form_data) VALUES (?, ?, ?, ?)",
        (job_id, "pending", "Project is in the queue...", json.dumps(form_data))
    )
    db.commit()
    
    thread = threading.Thread(
        target=run_ai_council_job, 
        args=(job_id, json.dumps(form_data))
    )
    thread.start()
    
    return jsonify({"job_id": job_id}), 202

# --- API Endpoint 2: Get Status (The Polling Endpoint) ---
@app.route("/api/v1/project-status/<job_id>", methods=["GET"])
def get_project_status(job_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))
    job = cursor.fetchone()

    if not job:
        return jsonify({"error": "Job not found"}), 404

    if job["status"] == "complete":
        # 2. NEW: Parse the string and return the JSON object
        return jsonify({
            "status": "complete",
            "final_report": json.loads(job["final_report"])
        })
    
    if job["status"] == "failed":
        return jsonify({
            "status": "failed",
            "error_message": job["current_task"]
        })

    return jsonify({
        "status": job["status"],
        "current_task": job["current_task"]
    })

# --- Run the Server ---
if __name__ == "__main__":
    init_db()
    print("Starting Flask server at http://127.0.0.1:5000")
    print("---")
    print("1. Open 'form.html' in your browser to create a new project.")
    print("2. 'form.html' will redirect you to 'report.html' to view the report.")
    print("---")
    app.run(debug=True, port=5000)