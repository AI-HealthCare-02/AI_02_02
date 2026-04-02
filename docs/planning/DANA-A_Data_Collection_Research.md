# DANA-A 데이터 수집 근거 리서치 보고서
## Evidence-Based Data Collection Matrix for Diabetes Prevention Web Service

---

## 1. 만성질환 예측 모델링 (Chronic Disease Prediction Modeling)

### 1.1 FINDRISC (Finnish Diabetes Risk Score) - 8 Features
**Reference: Lindstrom & Tuomilehto, Diabetes Care 2003;26:725-731**

| # | Feature | Type | Details |
|---|---------|------|---------|
| 1 | Age | Category | <45, 45-54, 55-64, >64 |
| 2 | BMI | Category | <25, 25-30, >30 kg/m2 |
| 3 | Waist Circumference | Category | M: <94, 94-102, >102cm / F: <80, 80-88, >88cm |
| 4 | Physical Activity | Binary | >30 min/day of moderate activity |
| 5 | Daily Fruit/Vegetable Intake | Binary | Daily consumption yes/no |
| 6 | History of Hypertension Medication | Binary | Ever used antihypertensive drugs |
| 7 | History of High Blood Glucose | Binary | Ever been told glucose is high |
| 8 | Family History of Diabetes | Category | No/Yes (1st degree)/Yes (2nd degree) |

- Score range: 0-26 points
- Risk categories: Low (0-6), Slightly Elevated (7-11), Moderate (12-14), High (15-20), Very High (21-26)
- Validated sensitivity: ~80%, AUC ~0.73
- Sources: [MDCalc FINDRISC](https://www.mdcalc.com/calc/4000/findrisc-finnish-diabetes-risk-score), [PubMed Validation](https://pubmed.ncbi.nlm.nih.gov/34302911/)

### 1.2 Korean Diabetes Risk Score (KDRS) - Two Versions

#### Simple Screening Score (Lee et al., Diabetes Care 2012;35:1723)
| # | Feature | Notes |
|---|---------|-------|
| 1 | Age | Categorized |
| 2 | Waist Circumference | Direct measurement (not BMI - easier for Korean population) |
| 3 | Family History of Diabetes | 1st degree relatives |
| 4 | Hypertension History | Yes/No |
| 5 | Smoking Status | Current/Former/Never |
| 6 | Alcohol Intake | Consumption level |

- Score range: 0-11, cut point >= 5 defines high risk
- Sensitivity: 81%, Specificity: 54%, AUC: 0.73
- Source: [Diabetes Care - Korean Screening Score](https://diabetesjournals.org/care/article/35/8/1723/29861/)

#### Extended 10-Year KDRS (Diabetes & Metabolism Journal, 2018)
| # | Feature | Notes |
|---|---------|-------|
| 1 | Age | Continuous/categorized |
| 2 | Family History of Diabetes | Yes/No |
| 3 | Alcohol Intake | Men only |
| 4 | Smoking Status | Current/Former/Never |
| 5 | Physical Activity | Level of activity |
| 6 | Antihypertensive Therapy | Yes/No |
| 7 | Statin Therapy | Yes/No |
| 8 | BMI | kg/m2 |
| 9 | Systolic Blood Pressure | mmHg |
| 10 | Total Cholesterol | Lab value |
| 11 | Fasting Glucose | Lab value |
| 12 | Gamma-Glutamyl Transferase (GGT) | Lab value |

- Based on Korean National Health Screening data (available annually for all insured adults)
- Source: [DMJ - KDRS Development](https://www.e-dmj.org/journal/view.php?doi=10.4093/dmj.2018.0014), [PMC Full Text](https://pmc.ncbi.nlm.nih.gov/articles/PMC6202558/)

### 1.3 Kaggle/ML Prediction Dataset Features

#### PIMA Indian Diabetes Dataset (Most widely used)
| # | Feature | Type |
|---|---------|------|
| 1 | Pregnancies | Count |
| 2 | Glucose (OGTT 2hr) | mg/dL |
| 3 | Blood Pressure (Diastolic) | mmHg |
| 4 | Skin Thickness (Triceps) | mm |
| 5 | Insulin (2hr serum) | mu U/ml |
| 6 | BMI | kg/m2 |
| 7 | Diabetes Pedigree Function | Genetic score |
| 8 | Age | Years |

- **Most salient features** (by mutual information): Glucose > BMI > Age > Insulin
- Sources: [Kaggle PIMA Dataset](https://www.kaggle.com/datasets/mathchi/diabetes-data-set), [PMC - Deep Learning PIMA](https://pmc.ncbi.nlm.nih.gov/articles/PMC7270283/)

#### Alternative Kaggle Prediction Dataset (100,000 records)
| Feature | Type |
|---------|------|
| Age | Numeric |
| Gender | Categorical |
| BMI | Numeric |
| Hypertension | Binary |
| Heart Disease | Binary |
| Smoking History | Categorical |
| HbA1c Level | Numeric |
| Blood Glucose Level | Numeric |

- Source: [Kaggle Diabetes Prediction Dataset](https://www.kaggle.com/datasets/iammustafatz/diabetes-prediction-dataset)

### 1.4 Korean National Health Data (NHID/KNHANES) for AI Prediction
- 133,387 instances, 73,767 subjects, 218 variables (57 selected)
- Key predictors: **Fasting Blood Glucose and HbA1c** are most significant
- Ensemble model achieved: Balanced accuracy 72.5%, AUC 0.791
- Sources: [Tandfonline - AI Prediction Korea](https://www.tandfonline.com/doi/full/10.1080/08839514.2022.2145644), [Lancet eClinicalMedicine](https://www.thelancet.com/journals/eclinm/article/PIIS2589-5370(25)00001-X/fulltext)

### 1.5 ADA Screening Guidelines (Standards of Care 2024-2025)
**Who to screen:**
- Adults of any age who are overweight/obese + >= 1 risk factor
- All adults >= 35 years regardless of risk factors
- Repeat every 3 years if normal; more frequently if prediabetic

**Key Risk Factors:**
- Overweight/obesity (especially abdominal/visceral)
- Dyslipidemia (high triglycerides, low HDL)
- Hypertension
- Family history (1st degree relative with diabetes)
- Race/ethnicity (Asian, Hispanic, Black, Native American)
- History of gestational diabetes
- PCOS
- Physical inactivity
- Certain medications (statins, thiazide diuretics, antipsychotics)

- Sources: [ADA Standards of Care](https://professional.diabetes.org/standards-of-care), [Diabetes Care 2025](https://diabetesjournals.org/care/article/48/Supplement_1/S27/157566/)

### 1.6 Daily/Periodic Data that Improves Prediction Over Time (Wearable/Longitudinal)
| Data Type | Source | Evidence |
|-----------|--------|----------|
| Heart Rate / HRV | Smartwatch/wearable | Subtle patterns reveal insulin resistance when combined with AI |
| Sleep Duration/Quality | Wearable/self-report | 7-8 hrs optimal; <5 hrs significantly increases risk |
| Daily Step Count | Pedometer/phone | 7,000 steps/day = 14% lower T2DM risk vs 2,000 |
| Physical Activity Minutes | Wearable/self-report | 150 min/week moderate-vigorous = 58% risk reduction |
| Weight Trends | Smart scale | 16% risk reduction per kg lost |
| Blood Glucose Patterns | CGM/SMBG | 10-14 day CGM assessment recommended |

- Sources: [Nature - Wearables & AI](https://www.nature.com/articles/s41746-025-02036-9), [PMC - Early Detection Wearables](https://pmc.ncbi.nlm.nih.gov/articles/PMC7787711/), [ScienceNews - Smartwatch Data](https://www.sciencenews.org/article/smartwatch-data-early-diabetes-risk)

---

## 2. 만성질환 추적 대시보드 (Chronic Disease Tracking Dashboard)

### 2.1 Essential Health Metrics & Recommended Frequency

| Metric | Frequency | Target Range | Source |
|--------|-----------|-------------|--------|
| **Blood Glucose (Fasting)** | Daily-Weekly (diabetic); Monthly (prediabetic) | <100 mg/dL normal, 100-125 prediabetes | ADA 2025 |
| **HbA1c** | Every 3-6 months | <5.7% normal, 5.7-6.4% prediabetes | ADA 2025 |
| **Weight / BMI** | Daily-Weekly | BMI <25; weight loss >5-7% if overweight | DPP Study |
| **Waist Circumference** | Monthly | M: <90cm, F: <85cm (Korean standard) | KDRS |
| **Blood Pressure** | Twice daily (if hypertensive); Weekly (otherwise) | <130/80 mmHg | ADA/AHA |
| **Physical Activity (min)** | Daily tracking | >= 150 min/week moderate-vigorous | ADA/DPP |
| **Steps/Day** | Daily | >= 7,000 steps/day | ADA Position Statement |
| **Sleep Duration** | Daily | 7-8 hours/night | Meta-analysis (Diabetes Care 2015) |
| **Food/Calorie Intake** | Daily (per meal ideally) | Individualized; 25-30g fiber/day | ADA Nutrition |
| **Water Intake** | Daily | F: 1.6L/day, M: 2L/day | PMC Research |
| **Stress Level** | Daily/Weekly | Self-assessed scale | Joseph 2017, NYAS |
| **Total Cholesterol/Lipids** | Every 6-12 months (lab) | LDL <100, HDL >40(M)/50(F) | ADA 2025 |
| **Smoking Status** | At intake + periodic check | Non-smoker target | ADA Guidelines |
| **Alcohol Consumption** | Weekly assessment | Moderate or less | Dose-response meta-analysis |

Sources:
- [ADA Standards of Care 2025](https://diabetesjournals.org/care/article/48/Supplement_1/S128/157561/)
- [PMC Dashboard Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7647008/)
- [Diabetes Care - Sleep & Diabetes](https://diabetesjournals.org/care/article/38/3/529/37556/)
- [PMC - Cortisol & Diabetes Link](https://pmc.ncbi.nlm.nih.gov/articles/PMC5334212/)

### 2.2 Digital Health Platform Tracking Comparison

| Feature | Livongo | Omada Health | Noom |
|---------|---------|-------------|------|
| **Blood Glucose** | Connected meter, auto-upload, avg 1.8x/day | N/A (prevention focus) | N/A |
| **Weight** | N/A | Wireless smart scale, daily encouraged | Daily weigh-in |
| **Physical Activity** | N/A | Pedometer, daily tracking | Step tracking |
| **Food/Meals** | N/A | App meal logging, daily | Daily food logging, calorie tracking |
| **Coaching** | Real-time algorithmic + CDE 24/7 | Weekly curriculum + personal coach | Daily lessons + coaching |
| **Program Duration** | Ongoing | 16-week core + maintenance | 16-week core |
| **Engagement Target** | Each BG check triggers feedback | 4 daily actions (login, weigh, log meal, log activity) | Daily lesson + logging |
| **Key Outcome** | 18.4% fewer hypo days, 16.4% fewer hyper days | -5.5% body weight at 12mo, HbA1c reduction | Weight loss, behavior change |

Sources:
- [PMC - Livongo Program](https://pmc.ncbi.nlm.nih.gov/articles/PMC5527250/)
- [Omada DPP Study](https://resourcecenter.omadahealth.com/omada-resources/new-peer-reviewed-study-shows-omada-health-s-online-diabetes-prevention-program-participants-maintained-reductions-in-weight-and-average-blood-sugar-levels-keeping-diabetes-at-bay)
- [PMC - Connected Diabetes Care](https://pmc.ncbi.nlm.nih.gov/articles/PMC7414210/)

### 2.3 Data Frequency for Meaningful Trend Detection

| Data Type | Minimum for Trends | Optimal | Evidence |
|-----------|-------------------|---------|----------|
| Blood Glucose | Weekly (prediabetes) | Daily (diabetes) | 10-14 day CGM assessment per ADA |
| Weight | Weekly | Daily | Omada: daily weigh-in best outcomes |
| Physical Activity | Daily | Daily with weekly summaries | DPP: weekly review of 150min target |
| Food/Diet | Daily | Per-meal | Omada: daily meal logging drives outcomes |
| Blood Pressure | 2x/week | 2x/day for 5+ days | AHA home monitoring guidelines |
| Sleep | Daily | Daily | Wearable auto-tracking |
| HbA1c | Every 3 months | Every 3 months | ADA: minimum 2x/year |
| Lipid Panel | Every 6 months | Every 3-6 months | ADA annual minimum |
| Waist Circumference | Monthly | Bi-weekly | FINDRISC/KDRS validation |

---

## 3. 생활습관 챌린지 (Lifestyle Habit Challenge)

### 3.1 Strongest Evidence-Based Lifestyle Interventions

#### Diabetes Prevention Program (DPP) - USA
- **Reference:** Knowler et al., NEJM 2002;346:393-403; Lifestyle description: PMC 2002
- **Results:** 58% diabetes risk reduction (vs 31% metformin)
- **22-year follow-up:** Still 25% reduced risk in lifestyle group
- **Core Goals:**
  - >= 7% body weight loss
  - >= 150 minutes/week moderate physical activity (like brisk walking)
- **Program Structure:** 16-session core curriculum, individual lifestyle coaches, supervised exercise
- Sources: [NIDDK - DPP](https://www.niddk.nih.gov/about-niddk/research-areas/diabetes/diabetes-prevention-program-dpp), [PMC - DPP Description](https://pmc.ncbi.nlm.nih.gov/articles/PMC1282458/), [ADA - 22yr Follow-up](https://diabetes.org/newsroom/new-data-from-diabetes-prevention-program-outcomes-study-shows-persistent-reduction-of-t2d-development-over-22-year-average-follow-up)

#### Da Qing Diabetes Prevention Study - China
- **Reference:** Pan et al., Diabetes Care 1997;20:537-544; 30-year follow-up: Lancet Diabetes Endocrinol 2019
- **Design:** 577 people with IGT, randomized to diet, exercise, or diet+exercise for 6 years
- **Results at 6 years:**
  - Control: 67.7% diabetes incidence
  - Diet only: 43.8%
  - Exercise only: 41.1%
  - Diet + Exercise: 46.0%
- **30-year follow-up results:**
  - Median delay in diabetes onset: 3.96 years
  - Fewer CVD events, microvascular complications
  - Fewer CVD deaths and all-cause deaths
  - Average life expectancy increase: 1.44 years
  - 47% reduction in severe retinopathy
- Sources: [PMC - 30yr Results](https://pmc.ncbi.nlm.nih.gov/articles/PMC8172050/), [PubMed - Original Study](https://pubmed.ncbi.nlm.nih.gov/9096977/)

### 3.2 Specific Measurable Behavior Targets from Clinical Evidence

| Behavior | Target | Evidence Level | Source |
|----------|--------|---------------|--------|
| **Weight Loss** | >= 5-7% of body weight | Strong (RCT) | DPP: 58% risk reduction; 16% per kg lost |
| **Aerobic Exercise** | >= 150 min/week moderate-vigorous | Strong (RCT) | DPP, ADA, Da Qing |
| **Daily Steps** | >= 7,000 steps/day | Moderate (Cohort) | 14% lower T2DM risk vs 2,000 steps |
| **Walking** | >= 30 min/day | Strong (Meta-analysis) | ~50% diabetes risk reduction |
| **Resistance Training** | 2-3 sessions/week on non-consecutive days | Moderate (RCT) | ACSM/ADA consensus |
| **Fiber Intake** | 25-30 g/day (women 25g, men 38g) | Strong (Cohort+RCT) | 20-30% reduced T2DM risk with high fiber |
| **Fruit/Vegetable** | Daily consumption | Strong (FINDRISC) | Included in validated risk scores |
| **Mediterranean/DASH Diet** | Adherence score | Strong (RCT) | 20% diabetes risk reduction |
| **Sleep Duration** | 7-8 hours/night | Strong (Meta-analysis) | U-shaped risk; <=5hr significantly increases risk |
| **Water Intake** | F: 1.6L/day, M: 2L/day | Moderate (Cohort) | Low intake associated with hyperglycemia |
| **Smoking Cessation** | Complete cessation | Strong (Meta-analysis) | Linear dose-response: 16% per 10 cig/day |
| **Alcohol** | Moderate or less | Moderate (Meta-analysis) | Light-moderate may be protective |
| **Stress Management** | Daily mindfulness/relaxation | Moderate (Mechanistic) | Cortisol dysregulation -> insulin resistance |
| **Sedentary Break** | Break every 30-60 min of sitting | Moderate (RCT) | ADA physical activity position statement |

Sources:
- [NEJM - DPP](https://www.nejm.org/doi/full/10.1056/NEJMoa012512)
- [PMC - Lifestyle Prevention Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6125024/)
- [Diabetes Care - Physical Activity](https://diabetesjournals.org/care/article/46/6/1132/148916/)
- [ADA - Weekly Exercise Targets](https://diabetes.org/health-wellness/fitness/weekly-exercise-targets)
- [PMC - ACSM Consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)

### 3.3 Tracking Frequency by Behavior Type

| Behavior | Tracking Frequency | Method | Rationale |
|----------|-------------------|--------|-----------|
| Steps | Daily | Passive (phone/watch) | Continuous motivation loop |
| Exercise Minutes | Per session (daily review) | Passive + manual | Weekly 150min target needs daily tracking |
| Weight | Daily | Smart scale or manual | Omada: daily weigh-in drives best outcomes |
| Food/Meals | Per meal (3-5x/day) | Manual logging | Omada: meal logging frequency correlates with weight loss |
| Water | Daily | Manual logging | Simple binary/quantity check |
| Sleep | Daily | Passive (wearable) or manual | Correlates with next-day glucose |
| Stress | Daily | Self-report (1-10 scale) | Cortisol's acute effects on glucose |
| Fruit/Veg | Daily | Manual logging | FINDRISC binary question |
| Sedentary Breaks | Per episode | Manual/reminder | Hard to track passively; reminder-based |
| Smoking | Daily | Self-report | During cessation: daily tracking critical |
| Alcohol | Per event | Manual logging | Weekly summary sufficient for trend |

---

## 4. COMPREHENSIVE DATA COLLECTION MATRIX

### 4.1 Complete Data Point Matrix

| # | Data Point | Feature 1 (Model) | Feature 2 (Dashboard) | Feature 3 (Challenge) | Collection Frequency | Collection Method | Priority | Clinical Reference |
|---|-----------|-------------------|----------------------|----------------------|---------------------|------------------|----------|-------------------|
| 1 | **Age** | YES (all scores) | Context | - | Once (at registration) | Question | CRITICAL | FINDRISC, KDRS, ADA, PIMA |
| 2 | **Sex/Gender** | YES | Context | - | Once | Question | CRITICAL | KDRS, Kaggle datasets |
| 3 | **Height** | YES (for BMI) | Context | - | Once | Question | CRITICAL | For BMI calculation |
| 4 | **Weight** | YES (for BMI) | YES (trend) | YES (weight loss goal) | Daily-Weekly | Smart scale / Manual | CRITICAL | DPP: 16% risk reduction per kg |
| 5 | **BMI** | YES (all scores) | YES (trend) | YES (derived from weight) | Calculated from 3+4 | Calculated | CRITICAL | FINDRISC, KDRS, PIMA, ADA |
| 6 | **Waist Circumference** | YES (FINDRISC, KDRS) | YES (monthly trend) | - | Monthly | Manual (tape measure) | CRITICAL | Stronger predictor than BMI for diabetes |
| 7 | **Family History of Diabetes** | YES (all scores) | Context | - | Once | Question | CRITICAL | FINDRISC, KDRS, ADA |
| 8 | **Hypertension History/Medication** | YES (FINDRISC, KDRS) | YES | - | Once + updates | Question | CRITICAL | FINDRISC, KDRS extended |
| 9 | **History of High Blood Glucose** | YES (FINDRISC) | YES | - | Once + updates | Question | CRITICAL | FINDRISC |
| 10 | **Physical Activity (min/week)** | YES (FINDRISC, KDRS) | YES (weekly trend) | YES (150min target) | Daily | Passive (wearable) + Manual | CRITICAL | DPP: 150min/wk = 58% reduction |
| 11 | **Daily Steps** | Improves model | YES (daily trend) | YES (7,000 step target) | Daily | Passive (phone/watch) | IMPORTANT | 7,000 steps = 14% lower risk |
| 12 | **Fruit/Vegetable Intake** | YES (FINDRISC) | YES (daily) | YES (daily target) | Daily | Manual (Yes/No or servings) | IMPORTANT | FINDRISC validated feature |
| 13 | **Smoking Status** | YES (KDRS) | YES | YES (cessation goal) | Once + periodic update | Question | IMPORTANT | 16% risk increase per 10 cig/day |
| 14 | **Alcohol Consumption** | YES (KDRS men) | YES | YES (moderation goal) | Weekly | Manual (frequency/amount) | IMPORTANT | Dose-response meta-analysis |
| 15 | **Fasting Blood Glucose** | YES (KDRS extended, PIMA) | YES (trend) | - | Every 3-6 months (lab) | Lab test result input | CRITICAL | Most significant AI predictor (Korean data) |
| 16 | **HbA1c** | YES (Kaggle, Korean) | YES (quarterly trend) | - | Every 3-6 months (lab) | Lab test result input | CRITICAL | ADA: minimum 2x/year; most significant predictor |
| 17 | **Blood Pressure** | YES (KDRS extended, PIMA) | YES (trend) | - | Weekly to 2x/daily | Home monitor / Manual | IMPORTANT | ADA hypertension & diabetes position |
| 18 | **Sleep Duration** | Improves model | YES (daily trend) | YES (7-8hr target) | Daily | Passive (wearable) or Manual | IMPORTANT | <=5hr significantly increases diabetes risk |
| 19 | **Sleep Quality** | Improves model | YES (trend) | YES (quality target) | Daily | Manual (1-5 scale) | NICE-TO-HAVE | Insomnia linked to metabolic disorders |
| 20 | **Stress Level** | Improves model | YES (trend) | YES (stress mgmt challenge) | Daily | Manual (1-10 scale) | IMPORTANT | Cortisol -> insulin resistance pathway |
| 21 | **Water Intake** | - | YES (daily) | YES (hydration target) | Daily | Manual (cups/L) | NICE-TO-HAVE | Low intake -> hyperglycemia risk |
| 22 | **Dietary Fiber Intake** | - | YES (trend) | YES (25-30g target) | Daily | Manual (estimated) | IMPORTANT | 20-30% risk reduction with high fiber |
| 23 | **Calorie Intake** | - | YES (trend) | YES (calorie target) | Daily (per meal) | Manual logging | IMPORTANT | Weight management is #1 predictor |
| 24 | **Total Cholesterol** | YES (KDRS extended) | YES (trend) | - | Every 6-12 months (lab) | Lab test result input | IMPORTANT | KDRS extended feature |
| 25 | **GGT (Gamma-GT)** | YES (KDRS extended) | YES (trend) | - | Every 6-12 months (lab) | Lab test result input | NICE-TO-HAVE | KDRS extended only |
| 26 | **Statin Use** | YES (KDRS extended) | Context | - | Once + updates | Question | IMPORTANT | KDRS, ADA risk factor |
| 27 | **Heart Rate / HRV** | Improves model | YES (trend) | - | Continuous/Daily | Passive (wearable) | NICE-TO-HAVE | Wearable AI studies show predictive value |
| 28 | **Race/Ethnicity** | YES (ADA) | Context | - | Once | Question | IMPORTANT | ADA: Asian, Hispanic at higher risk |
| 29 | **Gestational Diabetes History** | YES (ADA) | Context | - | Once | Question | IMPORTANT (women) | ADA screening guideline |
| 30 | **PCOS History** | YES (ADA) | Context | - | Once | Question | NICE-TO-HAVE (women) | ADA risk factor |
| 31 | **Sedentary Time / Breaks** | Improves model | YES (daily) | YES (break challenges) | Daily | Passive + Manual | NICE-TO-HAVE | ADA position statement |
| 32 | **Medication List** | YES (KDRS, ADA) | YES | - | Once + updates | Question | IMPORTANT | Statins, antipsychotics increase risk |
| 33 | **Meal Timing/Frequency** | - | YES (pattern) | YES (regular eating) | Daily | Manual | NICE-TO-HAVE | Circadian rhythm and metabolism |
| 34 | **Insulin (serum)** | YES (PIMA) | YES (if available) | - | Every 6-12 months (lab) | Lab test result input | NICE-TO-HAVE | PIMA dataset feature |
| 35 | **Depression/Mental Health Screen** | Improves model | YES (periodic) | YES (wellbeing target) | Monthly | Validated questionnaire (PHQ-2/9) | NICE-TO-HAVE | Bidirectional link depression-diabetes |

### 4.2 Collection Frequency Summary

| Frequency | Data Points |
|-----------|-------------|
| **Once (Registration)** | Age, Sex, Height, Family History, Race/Ethnicity, Gestational DM History, PCOS, Baseline medications |
| **Daily** | Weight, Steps, Exercise minutes, Sleep duration/quality, Stress, Water, Food/meals, Fruit/Veg intake |
| **Weekly** | Alcohol, Blood Pressure (if not hypertensive), Weekly activity summary |
| **Monthly** | Waist circumference, Depression screening |
| **Every 3-6 months** | HbA1c, Fasting Glucose |
| **Every 6-12 months** | Total Cholesterol, Lipid Panel, GGT, Insulin |
| **Per Update** | Smoking status changes, Medication changes, Hypertension diagnosis, High glucose episodes |

### 4.3 Passive vs Active Collection

| Collection Type | Data Points | Method |
|----------------|-------------|--------|
| **Fully Passive** | Steps, Heart Rate/HRV, Sleep Duration (if wearable), Exercise minutes (if wearable) | Phone sensors, Smartwatch, Fitness tracker |
| **Semi-Passive** | Weight (if smart scale), Blood Glucose (if connected meter), Blood Pressure (if connected monitor) | Connected devices auto-upload |
| **Active - Quick Input** | Water intake, Stress level, Sleep quality rating, Fruit/Veg (Yes/No), Sedentary breaks | Simple tap/slider in app (<10 sec) |
| **Active - Detailed Input** | Food/calorie logging, Meal content, Exercise type details | Requires 1-3 min per entry |
| **Active - Periodic** | Waist circumference, Lab results (HbA1c, glucose, cholesterol), Medication updates | Manual measurement or data entry |
| **One-Time Questions** | Age, Sex, Height, Family history, Medical history, Race/Ethnicity | Onboarding questionnaire |

### 4.4 Feature-Specific Data Requirements

#### For PREDICTION MODEL (Feature 1): MINIMUM Required
**One-time intake (Risk Score Calculation):**
1. Age
2. Sex
3. Height + Weight (-> BMI)
4. Waist Circumference
5. Family History of Diabetes
6. Hypertension History/Medication
7. History of High Blood Glucose
8. Physical Activity Level (>30min/day)
9. Daily Fruit/Vegetable Intake
10. Smoking Status
11. Alcohol Consumption

**Periodic Lab Values (Enhanced Prediction):**
12. Fasting Blood Glucose
13. HbA1c
14. Blood Pressure
15. Total Cholesterol

**Longitudinal Enhancement (Daily/Weekly data improves model over time):**
16. Weight trends
17. Physical activity trends
18. Sleep patterns
19. Heart Rate / HRV patterns

#### For DASHBOARD (Feature 2): MINIMUM Required
Display metrics that show trends over time:
1. Weight (weekly trend chart)
2. BMI (derived, monthly)
3. Physical Activity minutes (weekly summary)
4. Steps/Day (daily trend)
5. HbA1c (quarterly marker)
6. Blood Pressure (if applicable)
7. Sleep Duration (daily/weekly average)
8. Food/Diet Quality Score (daily/weekly)
9. Stress Level (weekly average)
10. Risk Score Trend (monthly recalculation)

#### For CHALLENGES (Feature 3): MINIMUM Required
Behaviors to track for challenge completion:
1. Daily Steps (target: 7,000+)
2. Weekly Exercise Minutes (target: 150+)
3. Daily Weight Check (target: 5-7% loss over program)
4. Daily Fruit/Vegetable Intake (target: 5+ servings)
5. Daily Water Intake (target: 8 cups)
6. Sleep Duration (target: 7-8 hours)
7. Food Logging (target: log 3 meals/day)
8. Stress Management Activity (target: daily practice)
9. Sedentary Breaks (target: break every 30-60 min)
10. Smoking Cessation Progress (if applicable)

---

## 5. KEY CLINICAL REFERENCES SUMMARY

| Study/Tool | Year | Key Finding | Application to DANA-A |
|-----------|------|-------------|----------------------|
| **FINDRISC** | 2003 | 8-item questionnaire, AUC 0.73, validated globally | Base risk score framework |
| **Korean DRS** | 2012/2018 | Korean-specific features, uses national health screening data | Korean population-adapted scoring |
| **DPP Study** | 2002 | 7% weight loss + 150min/wk = 58% risk reduction | Challenge targets |
| **DPP 22yr Follow-up** | 2024 | Still 25% reduced risk after 22 years | Long-term motivation messaging |
| **Da Qing Study** | 1997/2019 | 6yr intervention -> 30yr benefits, +1.44yr life expectancy | Exercise/diet challenge evidence |
| **ADA Standards of Care** | 2025 | Screening guidelines, glycemic targets, monitoring frequency | Dashboard frequency standards |
| **ACSM/ADA Consensus** | 2022 | 150-300 min/wk moderate-vigorous + 2-3 resistance sessions | Exercise challenge parameters |
| **Sleep Meta-analysis** | 2015 | U-shaped risk: 7-8hr optimal, <=5hr high risk | Sleep challenge target |
| **DPP Weight Loss** | 2006 | 16% risk reduction per kg lost (dose-response) | Weight challenge motivation |
| **Fiber & Diabetes** | 2000/2014 | 25-30g/day fiber -> 20-30% risk reduction | Diet challenge target |
| **Steps & Diabetes** | 2023 | 7,000 steps/day = 14% lower risk vs 2,000 | Walking challenge target |
| **Cortisol-Diabetes Link** | 2017 | HPA axis dysregulation links stress to insulin resistance | Stress management challenge |
| **Water & Glucose** | 2011 | Low water intake independently associated with hyperglycemia risk | Hydration challenge target |
| **Smoking Dose-Response** | 2015 | 16% risk increase per 10 cigarettes/day | Smoking cessation challenge |

---

## 6. CRITICAL DESIGN RECOMMENDATIONS

### 6.1 Minimum Viable Data Collection (MVP)
For DANA-A launch, the absolute minimum data collection should include:
1. **Onboarding questionnaire** (FINDRISC 8 items + Korean adaptations = ~15 questions)
2. **Daily tracking** (Weight, Steps, Exercise, 1 diet question = 4 data points)
3. **Periodic input** (Monthly waist circumference, Quarterly lab values when available)

### 6.2 Progressive Data Collection Strategy
- **Week 1-2:** Onboarding risk assessment (one-time questions)
- **Week 1-4:** Establish daily tracking habit (weight + steps only)
- **Week 3-8:** Add food logging and sleep tracking
- **Week 5-16:** Full tracking (all daily metrics + challenges)
- **Ongoing:** Periodic lab values, monthly measurements, risk score recalculation

### 6.3 User Burden Considerations
- Omada evidence shows **4 daily engagement touchpoints** (login, weigh, log meal, log activity) is sustainable
- Livongo shows **automatic data upload** (passive collection) dramatically increases engagement
- Each manual entry should take **<10 seconds** (tap/slider) to maintain adherence
- Complex logging (food details) should be **optional enhancement**, not required
- Weekly summary views maintain motivation without daily overload

### 6.4 Data Collection Priority Tiers

**Tier 1 - CRITICAL (Must collect):**
Age, Sex, Height, Weight, BMI, Waist Circumference, Family History, Hypertension, High Glucose History, Physical Activity Level, Fruit/Veg Intake, Smoking Status

**Tier 2 - IMPORTANT (Should collect):**
Daily Steps, Exercise Minutes, Blood Pressure, Sleep Duration, Fasting Glucose, HbA1c, Alcohol, Stress Level, Dietary Fiber/Quality, Cholesterol, Medication List, Race/Ethnicity

**Tier 3 - NICE-TO-HAVE (Enhance with):**
Heart Rate/HRV, Sleep Quality, Water Intake, GGT, Insulin, PCOS, Sedentary Breaks, Meal Timing, Depression Screen, Detailed Food Logging
