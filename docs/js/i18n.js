// Telugu (తెలుగు) option. The app is written in English; when a viewer picks Telugu, every piece of
// on-screen text that has a translation below is swapped as it appears (pages, dialogs, toasts, live
// updates). Data people typed (names, descriptions, categories) is shown as entered, and saved data
// and WhatsApp messages stay in English. The choice is kept per phone.

const KEY = 'svln-lang';
export const getLang = () => { try { return localStorage.getItem(KEY) === 'te' ? 'te' : 'en'; } catch { return 'en'; } };
export const setLang = lang => { try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ } };

const TE = {
  // navigation and page titles
  'Home': 'హోమ్', 'Expenses': 'ఖర్చులు', 'Dues': 'బకాయిలు', 'Reports': 'నివేదికలు', 'Staff': 'సిబ్బంది',
  'Vendors': 'వెండర్లు', 'Notices': 'ప్రకటనలు', 'Settings': 'సెట్టింగ్‌లు', 'More': 'మరిన్ని', 'My flat': 'నా ఫ్లాట్',
  'Overview': 'అవలోకనం', 'Maintenance dues': 'మెయింటెనెన్స్ బకాయిలు', 'Vendors & contracts': 'వెండర్లు & ఒప్పందాలు',
  'Maintenance': 'మెయింటెనెన్స్', 'Maintenance & expenses': 'మెయింటెనెన్స్ & ఖర్చులు',
  'Loading…': 'లోడ్ అవుతోంది…', 'Skip to content': 'విషయానికి వెళ్లండి', 'View as': 'ఇలా చూడండి', 'Demo': 'డెమో', 'Stage': 'స్టేజ్', 'Website developed by': 'వెబ్‌సైట్ రూపొందించినవారు',

  // common buttons
  'Save': 'సేవ్ చేయండి', 'Cancel': 'రద్దు', 'Edit': 'మార్చండి', 'Delete': 'తొలగించండి', 'Close': 'మూసివేయండి',
  'Remove': 'తీసివేయండి', 'remove': 'తీసివేయండి', 'Copy': 'కాపీ', 'Export': 'ఎగుమతి', 'View': 'చూడండి', 'Details': 'వివరాలు',
  'Rename': 'పేరు మార్చండి', 'Remind': 'గుర్తు చేయండి', 'Call': 'కాల్', 'WhatsApp': 'వాట్సాప్', 'Install': 'ఇన్‌స్టాల్',
  'Not now': 'ఇప్పుడు కాదు', 'See all': 'అన్నీ చూడండి', 'Print / PDF': 'ప్రింట్ / PDF', 'Choose…': 'ఎంచుకోండి…',
  'Sign in': 'సైన్ ఇన్', 'Sign out': 'సైన్ అవుట్', 'Create account': 'ఖాతా సృష్టించండి', 'Continue with Google': 'Google తో కొనసాగండి',
  'or use email': 'లేదా ఈమెయిల్ వాడండి', 'Save and continue': 'సేవ్ చేసి కొనసాగండి', 'Complete now': 'ఇప్పుడే పూర్తి చేయండి',
  'Send on WhatsApp': 'వాట్సాప్‌లో పంపండి', 'Previous year': 'గత సంవత్సరం', 'Next year': 'తదుపరి సంవత్సరం',
  'Switch light or dark theme': 'లైట్ / డార్క్ థీమ్ మార్చండి', 'Light / dark': 'లైట్ / డార్క్',

  // home
  'Balance in hand': 'చేతిలో ఉన్న నిల్వ', 'Collected': 'వసూలు', 'Spent': 'ఖర్చు', 'Collected vs spent': 'వసూలు vs ఖర్చు',
  'by month': 'నెలవారీగా', 'Where the money went': 'డబ్బు ఎక్కడ ఖర్చయింది', 'Show spending for': 'ఖర్చు చూపించు',
  'Recent expenses': 'ఇటీవలి ఖర్చులు', 'Post notice': 'ప్రకటన పెట్టండి', 'Spending by category': 'విభాగాల వారీగా ఖర్చు',
  'spent': 'ఖర్చు', 'spent this year': 'ఈ సంవత్సరం ఖర్చు', 'Others': 'ఇతరాలు', 'Only you right now': 'ప్రస్తుతం మీరు మాత్రమే',
  'You': 'మీరు', 'Admin': 'అడ్మిన్', 'Resident': 'నివాసి', 'Member': 'సభ్యుడు',
  'Demo with sample data': 'నమూనా డేటాతో డెమో', 'All paid up': 'అన్నీ చెల్లించారు', 'Thank you!': 'ధన్యవాదాలు!',
  'Thank you for paying on time.': 'సమయానికి చెల్లించినందుకు ధన్యవాదాలు.', 'No accounts yet': 'ఇంకా ఖాతాలు లేవు',
  'Monthly bills': 'నెలవారీ బిల్లులు', 'Not added this month': 'ఈ నెల ఇంకా జోడించలేదు',
  'Install SVLN app': 'SVLN యాప్ ఇన్‌స్టాల్ చేయండి', 'Install the SVLN app': 'SVLN యాప్ ఇన్‌స్టాల్ చేయండి', 'SVLN app installed': 'SVLN యాప్ ఇన్‌స్టాల్ అయింది',
  'Every flat has complete details.': 'అన్ని ఫ్లాట్ల వివరాలు పూర్తయ్యాయి.', '✓ Every flat has complete details.': '✓ అన్ని ఫ్లాట్ల వివరాలు పూర్తయ్యాయి.',
  '✓ All flat details are complete. Thank you!': '✓ ఫ్లాట్ వివరాలన్నీ పూర్తయ్యాయి. ధన్యవాదాలు!',
  'Copy reminders': 'రిమైండర్లు కాపీ చేయండి', 'Copy all reminders': 'అన్ని రిమైండర్లు కాపీ చేయండి', 'See all flats': 'అన్ని ఫ్లాట్లు చూడండి',
  'Still needed:': 'ఇంకా కావాల్సినవి:',

  // expenses
  'Add expense': 'ఖర్చు జోడించండి', 'Edit expense': 'ఖర్చు మార్చండి', 'Every rupee spent from the maintenance fund.': 'మెయింటెనెన్స్ నిధి నుండి ఖర్చయిన ప్రతి రూపాయి.',
  'Search description, vendor…': 'వివరణ, వెండర్ వెతకండి…', 'Search expenses': 'ఖర్చులు వెతకండి', 'Sort': 'క్రమం',
  'All months': 'అన్ని నెలలు', 'All categories': 'అన్ని విభాగాలు', 'All vendors': 'అన్ని వెండర్లు',
  'Newest first': 'కొత్తవి ముందు', 'Oldest first': 'పాతవి ముందు', 'Highest amount': 'ఎక్కువ మొత్తం ముందు', 'Lowest amount': 'తక్కువ మొత్తం ముందు',
  'Date': 'తేదీ', 'Amount (₹)': 'మొత్తం (₹)', 'Category': 'విభాగం', 'Description': 'వివరణ', 'Vendor / paid to': 'వెండర్ / ఎవరికి చెల్లించారు',
  'Payment mode': 'చెల్లింపు విధానం', 'Paid by': 'చెల్లించినవారు', 'Receipt or bill (photo or PDF)': 'రసీదు లేదా బిల్లు (ఫోటో లేదా PDF)',
  'Pick from the list or type a new one': 'జాబితా నుండి ఎంచుకోండి లేదా కొత్తది టైప్ చేయండి', 'No expenses yet.': 'ఇంకా ఖర్చులు లేవు.',
  'Expense deleted': 'ఖర్చు తొలగించబడింది', 'Expense added': 'ఖర్చు జోడించబడింది', 'Expense updated': 'ఖర్చు మార్చబడింది',
  'Receipt attached': 'రసీదు జత చేయబడింది', 'No receipt attached.': 'రసీదు జత చేయలేదు.', 'No expenses match these filters.': 'ఈ ఫిల్టర్లకు సరిపోయే ఖర్చులు లేవు.',
  'No expenses recorded yet.': 'ఇంకా ఖర్చులు నమోదు కాలేదు.', 'No expenses recorded this year yet.': 'ఈ సంవత్సరం ఇంకా ఖర్చులు నమోదు కాలేదు.',
  'This is a salary payment. To change it, delete it and pay again from Staff.': 'ఇది జీతం చెల్లింపు. మార్చాలంటే, తొలగించి సిబ్బంది పేజీ నుండి మళ్లీ చెల్లించండి.',

  // dues
  'Who has paid': 'ఎవరు చెల్లించారు', 'Pending dues': 'పెండింగ్ బకాయిలు', 'Flats & amount': 'ఫ్లాట్లు & మొత్తం',
  'Paid': 'చెల్లించారు', 'Due': 'బకాయి', 'Overdue': 'గడువు దాటింది', 'Partly paid': 'కొంత చెల్లించారు', 'Pending': 'పెండింగ్',
  'Tap a box to record or view a payment.': 'చెల్లింపు నమోదు చేయడానికి లేదా చూడటానికి బాక్స్‌ను నొక్కండి.',
  'No pending dues': 'పెండింగ్ బకాయిలు లేవు', 'Save payment': 'చెల్లింపు సేవ్ చేయండి', 'Payment recorded': 'చెల్లింపు నమోదైంది',
  'Payment removed': 'చెల్లింపు తీసివేయబడింది', 'Received on': 'అందిన తేదీ', 'Received by': 'అందుకున్నవారు', 'Mode': 'విధానం',
  'UPI ref / note': 'UPI రెఫరెన్స్ / గమనిక', 'Paid so far': 'ఇప్పటివరకు చెల్లించినది', 'Last paid': 'చివరిసారి చెల్లించినది',
  'Monthly maintenance amount': 'నెలవారీ మెయింటెనెన్స్ మొత్తం', 'Same for every flat': 'అన్ని ఫ్లాట్లకు ఒకటే',
  'By flat area (₹ per sq. ft.)': 'ఫ్లాట్ విస్తీర్ణం ప్రకారం (చ.అ.కు ₹)', 'Amount per flat (₹)': 'ఒక్కో ఫ్లాట్‌కు మొత్తం (₹)',
  'Rate per sq. ft. (₹)': 'చ.అ.కు రేటు (₹)', 'Applies from (month)': 'ఏ నెల నుండి వర్తిస్తుంది', 'Due by day of month': 'నెలలో చెల్లించాల్సిన తేదీ',
  'Save amount': 'మొత్తం సేవ్ చేయండి', 'Maintenance amount saved': 'మెయింటెనెన్స్ మొత్తం సేవ్ అయింది', 'Add flat': 'ఫ్లాట్ జోడించండి',
  'Show incomplete only': 'అసంపూర్తి మాత్రమే చూపించు', 'Flat': 'ఫ్లాట్', 'Owner': 'యజమాని', 'Tenant': 'అద్దెదారు', 'Vacant': 'ఖాళీ',
  'Area (sq. ft.)': 'విస్తీర్ణం (చ.అ.)', 'Billing': 'బిల్లింగ్', 'Profile': 'ప్రొఫైల్', 'Logins': 'లాగిన్‌లు', 'Status': 'స్థితి',
  'Flat number': 'ఫ్లాట్ నంబర్', 'Owner name': 'యజమాని పేరు', 'Delete flat': 'ఫ్లాట్ తొలగించండి', 'Flat deleted': 'ఫ్లాట్ తొలగించబడింది',
  'Custom monthly amount (₹, optional)': 'ప్రత్యేక నెలవారీ మొత్తం (₹, ఐచ్ఛికం)', 'Leave empty to use the standard amount': 'సాధారణ మొత్తం కోసం ఖాళీగా వదలండి',
  'How to pay': 'ఎలా చెల్లించాలి', 'Enter an amount greater than zero.': 'సున్నా కంటే ఎక్కువ మొత్తం ఇవ్వండి.', 'Enter a flat number.': 'ఫ్లాట్ నంబర్ ఇవ్వండి.',
  'No flats yet.': 'ఇంకా ఫ్లాట్లు లేవు.', 'Your account is not linked to a flat yet. Ask the treasurer to link it.': 'మీ ఖాతా ఇంకా ఫ్లాట్‌కు జోడించబడలేదు. కోశాధికారిని అడగండి.',

  // flat details
  'Flat details': 'ఫ్లాట్ వివరాలు', 'Add details': 'వివరాలు జోడించండి', 'Edit details': 'వివరాలు మార్చండి', 'Details saved': 'వివరాలు సేవ్ అయ్యాయి',
  'Living here': 'ఇక్కడ ఉంటున్నవారు', 'Mobile': 'మొబైల్', 'Mobile (WhatsApp)': 'మొబైల్ (వాట్సాప్)', 'Mobile (optional)': 'మొబైల్ (ఐచ్ఛికం)',
  'Other phone': 'మరో ఫోన్', 'Email': 'ఈమెయిల్', 'Family members': 'కుటుంబ సభ్యులు', 'Vehicles': 'వాహనాలు', 'No vehicles': 'వాహనాలు లేవు',
  'Emergency contact': 'అత్యవసర సంప్రదింపు', 'Emergency contact name': 'అత్యవసర సంప్రదింపు పేరు', 'Emergency contact phone': 'అత్యవసర సంప్రదింపు ఫోన్',
  'Tenant name (if rented)': 'అద్దెదారు పేరు (అద్దెకు ఇస్తే)', 'Name': 'పేరు', 'Relation': 'బంధుత్వం', 'Age': 'వయస్సు',
  'Owner / resident': 'యజమాని / నివాసి', 'Owner / resident name': 'యజమాని / నివాసి పేరు', 'Logins for this flat': 'ఈ ఫ్లాట్ లాగిన్‌లు',
  'Please add each person living in the flat.': 'ఫ్లాట్‌లో ఉంటున్న ప్రతి వ్యక్తిని జోడించండి.',
  'Registration numbers, e.g. car and bike': 'రిజిస్ట్రేషన్ నంబర్లు, ఉదా. కారు, బైక్', 'You\'re signed in as': 'మీరు సైన్ ఇన్ అయినది',
  'No details yet. Add the owner name and a phone number so the treasurer can reach this flat.': 'ఇంకా వివరాలు లేవు. కోశాధికారి సంప్రదించేలా యజమాని పేరు, ఫోన్ నంబర్ జోడించండి.',
  'Who lives here (owner / tenant / vacant)': 'ఇక్కడ ఎవరు ఉంటున్నారు (యజమాని / అద్దెదారు / ఖాళీ)',
  'Mobile number': 'మొబైల్ నంబర్', 'Tenant name': 'అద్దెదారు పేరు', 'Vehicles (or “No vehicles”)': 'వాహనాలు (లేదా “వాహనాలు లేవు”)',
  'Self': 'స్వయం', 'Spouse': 'భార్య / భర్త', 'Son': 'కుమారుడు', 'Daughter': 'కుమార్తె', 'Father': 'తండ్రి', 'Mother': 'తల్లి',
  'Brother': 'సోదరుడు', 'Sister': 'సోదరి', 'Grandparent': 'తాత / అమ్మమ్మ', 'Grandchild': 'మనవడు / మనవరాలు', 'Other': 'ఇతర',

  // house tax
  'House tax': 'ఇంటి పన్ను', 'House tax by flat': 'ఫ్లాట్ల వారీగా ఇంటి పన్ను', 'Assessment number': 'అసెస్‌మెంట్ నంబర్', 'Assessment no.': 'అసెస్‌మెంట్ నం.',
  'Add assessment number': 'అసెస్‌మెంట్ నంబర్ జోడించండి', 'Tax document': 'పన్ను పత్రం', 'Document': 'పత్రం', 'Not uploaded': 'అప్‌లోడ్ చేయలేదు',
  'Not added': 'జోడించలేదు', 'Not added yet': 'ఇంకా జోడించలేదు', 'Mark paid': 'చెల్లించినట్లు గుర్తించండి', 'Paid ✓': 'చెల్లించారు ✓',
  'Upcoming': 'రాబోయేది', 'Due today': 'ఈరోజే గడువు', '1st half-year': 'మొదటి అర్ధ సంవత్సరం', '2nd half-year': 'రెండవ అర్ధ సంవత్సరం',
  'As printed on the tax bill': 'పన్ను బిల్లుపై ఉన్నట్లు', 'Tax bill or receipt (photo or PDF)': 'పన్ను బిల్లు లేదా రసీదు (ఫోటో లేదా PDF)',
  'Paid on': 'చెల్లించిన తేదీ', 'Receipt / transaction number': 'రసీదు / లావాదేవీ నంబర్', 'Not paid after all (remove this payment)': 'చెల్లించలేదు (ఈ చెల్లింపు తీసివేయండి)',
  'House tax details saved': 'ఇంటి పన్ను వివరాలు సేవ్ అయ్యాయి', 'House tax marked paid': 'ఇంటి పన్ను చెల్లించినట్లు గుర్తించబడింది',
  'House tax settings saved': 'ఇంటి పన్ను సెట్టింగ్‌లు సేవ్ అయ్యాయి', 'Visible only to this flat and the treasurer.': 'ఈ ఫ్లాట్ మరియు కోశాధికారికి మాత్రమే కనిపిస్తుంది.',
  'Set the house tax due dates': 'ఇంటి పన్ను గడువు తేదీలు సెట్ చేయండి', 'Due month': 'గడువు నెల', 'Due day': 'గడువు రోజు', 'Not set': 'సెట్ చేయలేదు',
  'Remind this many days before': 'ఇన్ని రోజుల ముందు గుర్తు చేయండి',
  'The treasurer has not set the house tax due dates yet.': 'కోశాధికారి ఇంకా ఇంటి పన్ను గడువు తేదీలు సెట్ చేయలేదు.',
  'Set the house tax due dates in Settings to turn on reminders.': 'రిమైండర్ల కోసం సెట్టింగ్‌లలో ఇంటి పన్ను గడువు తేదీలు సెట్ చేయండి.',
  'Each flat pays its own house tax in two half-yearly instalments. Set the last date to pay each one; flats see a reminder on Home before it is due.':
    'ప్రతి ఫ్లాట్ తన ఇంటి పన్నును రెండు అర్ధ వార్షిక వాయిదాల్లో చెల్లిస్తుంది. ప్రతి వాయిదా చివరి తేదీ సెట్ చేయండి; గడువుకు ముందు హోమ్‌లో రిమైండర్ కనిపిస్తుంది.',
  'This PDF is too large (max 650 KB). Upload a photo of the bill instead.': 'ఈ PDF చాలా పెద్దది (గరిష్ఠం 650 KB). బదులుగా బిల్లు ఫోటో అప్‌లోడ్ చేయండి.',
  'Upload a photo or a PDF of the tax bill.': 'పన్ను బిల్లు ఫోటో లేదా PDF అప్‌లోడ్ చేయండి.', 'This photo is too large. Try a smaller photo.': 'ఈ ఫోటో చాలా పెద్దది. చిన్న ఫోటో ప్రయత్నించండి.',
  'The tax document could not be found.': 'పన్ను పత్రం దొరకలేదు.',
  'Pay online': 'ఆన్‌లైన్‌లో చెల్లించండి',
  'Split expenses': 'పంచుకునే ఖర్చులు', 'Split an expense': 'ఖర్చును పంచండి', 'Split expense': 'ఖర్చును పంచండి',
  'What for': 'దేనికోసం', 'Total cost (₹)': 'మొత్తం ఖర్చు (₹)', 'Split': 'పంపకం', 'Equally': 'సమానంగా', 'By flat area': 'ఫ్లాట్ విస్తీర్ణం ప్రకారం',
  "I'll type each share": 'ప్రతి వాటా నేనే టైప్ చేస్తాను', 'Pay in': 'చెల్లింపు', 'One payment': 'ఒకేసారి', 'one payment': 'ఒకేసారి',
  'First payment due by': 'మొదటి చెల్లింపు గడువు', 'Note for residents (optional)': 'నివాసితులకు గమనిక (ఐచ్ఛికం)', 'Share per flat': 'ఒక్కో ఫ్లాట్ వాటా',
  'Also add it to Expenses (paid from the fund)': 'ఖర్చులలో కూడా చేర్చండి (నిధి నుండి చెల్లించారు)',
  'The cost is shared by the flats. Set a flat\'s share to 0 to leave it out.': 'ఖర్చును ఫ్లాట్లు పంచుకుంటాయి. ఏదైనా ఫ్లాట్‌ను వదిలేయాలంటే దాని వాటా 0 పెట్టండి.',
  'One-off costs like a borewell repair or painting, shared by the flats. Each flat can pay at once or in monthly instalments.': 'బోర్‌వెల్ రిపేర్, పెయింటింగ్ వంటి ఒకసారి ఖర్చులు, ఫ్లాట్లు పంచుకుంటాయి. ప్రతి ఫ్లాట్ ఒకేసారి లేదా నెలవారీ వాయిదాలలో చెల్లించవచ్చు.',
  'Paid for something yourself?': 'మీరే ఏదైనా ఖర్చు చేశారా?', 'Ask the treasurer to split it among the flats.': 'దాన్ని ఫ్లాట్లకు పంచమని కోశాధికారిని అడగండి.',
  'Send a cost': 'ఖర్చు పంపండి', 'Paid for something?': 'ఏదైనా చెల్లించారా?', 'What did you pay for': 'దేనికి చెల్లించారు', 'Amount paid (₹)': 'చెల్లించిన మొత్తం (₹)',
  'Paid on': 'చెల్లించిన తేదీ', 'Details (optional)': 'వివరాలు (ఐచ్ఛికం)', 'Bill or receipt (photo or PDF, optional)': 'బిల్ లేదా రసీదు (ఫోటో లేదా PDF, ఐచ్ఛికం)',
  'Send for approval': 'ఆమోదానికి పంపండి', 'Sent to the treasurer for approval': 'ఆమోదం కోసం కోశాధికారికి పంపబడింది', 'Waiting for approval': 'ఆమోదం కోసం వేచి ఉంది',
  'Approved': 'ఆమోదించారు', 'Not approved': 'ఆమోదించలేదు', 'Not approve': 'ఆమోదించవద్దు', 'Approve & split': 'ఆమోదించి పంచండి', 'Withdraw': 'వెనక్కి తీసుకోండి',
  'Request withdrawn': 'అభ్యర్థన వెనక్కి తీసుకున్నారు', 'Request not approved': 'అభ్యర్థన ఆమోదించలేదు', 'Approved and split among the flats': 'ఆమోదించి ఫ్లాట్లకు పంచబడింది',
  'Reason (shown to the flat)': 'కారణం (ఫ్లాట్‌కు కనిపిస్తుంది)', 'Bill': 'బిల్', 'Say what you paid for.': 'దేనికి చెల్లించారో రాయండి.', 'Enter the amount you paid.': 'చెల్లించిన మొత్తం నమోదు చేయండి.',
  'Total cost': 'మొత్తం ఖర్చు', 'Collected so far': 'ఇప్పటివరకు వసూలు', 'Still to collect': 'ఇంకా వసూలు చేయాల్సింది', 'Each flat': 'ప్రతి ఫ్లాట్', 'Your flat': 'మీ ఫ్లాట్',
  'Shared': 'పంపకం', 'Bill paid by': 'బిల్ చెల్లించినవారు',
  'Save a backup automatically once a day on this device (the first time I open the app)': 'ఈ పరికరంలో రోజుకు ఒకసారి ఆటోమేటిక్‌గా బ్యాకప్ సేవ్ చేయండి (రోజులో మొదటిసారి యాప్ తెరిచినప్పుడు)',
  'No backup taken yet.': 'ఇంకా బ్యాకప్ తీసుకోలేదు.', 'Backup saved': 'బ్యాకప్ సేవ్ అయింది',
  'Daily backup is on for this device': 'ఈ పరికరంలో రోజువారీ బ్యాకప్ ఆన్‌లో ఉంది', 'Daily backup is off for this device': 'ఈ పరికరంలో రోజువారీ బ్యాకప్ ఆఫ్‌లో ఉంది',
  'Electricity bill': 'కరెంట్ బిల్లు', 'Electricity': 'కరెంట్', 'Service Number': 'సర్వీస్ నంబర్', 'Add Service Number': 'సర్వీస్ నంబర్ చేర్చండి',
  'View / pay bill': 'బిల్లు చూడండి / చెల్లించండి', 'View bill': 'బిల్లు చూడండి', 'Service Number saved': 'సర్వీస్ నంబర్ సేవ్ అయింది',
  'Each flat pays its own electricity bill. Visible only to this flat and the treasurer.': 'ప్రతి ఫ్లాట్ తన కరెంట్ బిల్లు తానే చెల్లిస్తుంది. ఈ ఫ్లాట్‌కు, కోశాధికారికి మాత్రమే కనిపిస్తుంది.',
  'Copies your Service Number — paste it on the Eastern Power page to see or pay the bill.': 'మీ సర్వీస్ నంబర్ కాపీ అవుతుంది — ఈస్టర్న్ పవర్ పేజీలో పేస్ట్ చేసి బిల్లు చూడండి లేదా చెల్లించండి.',
  'Common area electricity': 'కామన్ ఏరియా కరెంట్', 'Common meter': 'కామన్ మీటర్', 'Recent bills': 'ఇటీవలి బిల్లులు', "Each flat's electricity": 'ప్రతి ఫ్లాట్ కరెంట్',
  'Each flat pays its own bill': 'ప్రతి ఫ్లాట్ తన బిల్లు తానే చెల్లిస్తుంది', 'Meter reading': 'మీటర్ రీడింగ్', 'Units used': 'వాడిన యూనిట్లు', 'Units': 'యూనిట్లు',
  'Common meter Service Number(s)': 'కామన్ మీటర్ సర్వీస్ నంబర్(లు)', 'Bill page link': 'బిల్లు పేజీ లింక్', 'Electricity settings saved': 'కరెంట్ సెట్టింగ్‌లు సేవ్ అయ్యాయి',
  'Change in Settings': 'సెట్టింగ్‌లలో మార్చండి',
  'Add your electricity Service Number': 'మీ కరెంట్ సర్వీస్ నంబర్ చేర్చండి',
  'It is the Consumer No on your power bill. Then you can see all your bills and payments, and pay, from the app.': 'ఇది మీ కరెంట్ బిల్లుపై ఉన్న కన్స్యూమర్ నంబర్. తర్వాత మీ అన్ని బిల్లులు, చెల్లింపులు యాప్‌లోనే చూడవచ్చు, చెల్లించవచ్చు.',
  'Units, bills and payments (from Eastern Power)': 'యూనిట్లు, బిల్లులు, చెల్లింపులు (ఈస్టర్న్ పవర్ నుండి)',
  'No split expenses yet.': 'ఇంకా పంచుకునే ఖర్చులు లేవు.', 'Your share': 'మీ వాటా', 'Share': 'వాటా',
  'Record payment': 'చెల్లింపు నమోదు చేయండి', 'Payment': 'చెల్లింపు', 'Payments': 'చెల్లింపులు',
  'No due date': 'గడువు తేదీ లేదు', 'Expense split among the flats': 'ఖర్చు ఫ్లాట్లకు పంచబడింది', 'Split expense updated': 'పంచుకునే ఖర్చు మార్చబడింది',
  'Split expense deleted': 'పంచుకునే ఖర్చు తొలగించబడింది', 'Set when the first instalment is due.': 'మొదటి వాయిదా గడువు తేదీ పెట్టండి.',
  'Give at least one flat a share.': 'కనీసం ఒక ఫ్లాట్‌కు వాటా ఇవ్వండి.', 'Say what the expense is for.': 'ఖర్చు దేనికోసమో రాయండి.', 'Enter the total cost.': 'మొత్తం ఖర్చు నమోదు చేయండి.',
  'Penalty added by GVMC (₹)': 'GVMC జోడించిన పెనాల్టీ (₹)', 'Penalty (added by GVMC)': 'పెనాల్టీ (GVMC జోడించినది)', 'Penalty': 'పెనాల్టీ',
  'Tax due': 'చెల్లించాల్సిన పన్ను', 'Total due': 'మొత్తం చెల్లించాల్సింది',
  'Alert': 'అలర్ట్', 'Alert on': 'అలర్ట్ ఉంది', 'Message from the treasurer': 'కోశాధికారి నుండి సందేశం', 'Title (optional)': 'శీర్షిక (ఐచ్ఛికం)',
  'Style': 'రకం', 'Information': 'సమాచారం', 'Reminder': 'రిమైండర్', 'Urgent': 'అత్యవసరం', 'Show until (optional)': 'ఈ తేదీ వరకు చూపించు (ఐచ్ఛికం)',
  'Save alert': 'అలర్ట్ సేవ్ చేయండి', 'Remove alert': 'అలర్ట్ తీసివేయండి', 'Alert saved': 'అలర్ట్ సేవ్ అయింది', 'Alert removed': 'అలర్ట్ తీసివేయబడింది',
  'Use house tax message': 'ఇంటి పన్ను సందేశం వాడండి', 'Type the message to show.': 'చూపించాల్సిన సందేశం టైప్ చేయండి.',
  'Shown at the top of Home and My flat for this flat only.': 'ఈ ఫ్లాట్‌కు మాత్రమే హోమ్, నా ఫ్లాట్ పేజీల పైన కనిపిస్తుంది.',
  'Each shows only to that flat. Change or remove them in Dues → Flats & amount.': 'ప్రతిదీ ఆ ఫ్లాట్‌కు మాత్రమే కనిపిస్తుంది. బకాయిలు → ఫ్లాట్లు & మొత్తం లో మార్చండి లేదా తీసివేయండి.', 'This is a courtesy reminder: house tax is due.': 'ఇది మర్యాదపూర్వక రిమైండర్: ఇంటి పన్ను బకాయి ఉంది.',
  'Usage': 'వినియోగం', 'Dues / My flat': 'బకాయిలు / నా ఫ్లాట్', 'Who opens the app and what they tap. Visible only to admins.': 'యాప్ ఎవరు తెరుస్తున్నారు, ఏమి నొక్కుతున్నారు. అడ్మిన్‌లకు మాత్రమే కనిపిస్తుంది.',
  'Refresh': 'రిఫ్రెష్', 'Today': 'ఈరోజు', '7 days': '7 రోజులు', '30 days': '30 రోజులు', '90 days': '90 రోజులు',
  'Visits': 'సందర్శనలు', 'People': 'వ్యక్తులు', 'Taps': 'నొక్కినవి', 'Installed app': 'ఇన్‌స్టాల్ చేసిన యాప్', 'signed-in members': 'సైన్ ఇన్ అయిన సభ్యులు',
  'people using the SVLN app': 'SVLN యాప్ వాడుతున్నవారు', 'Person': 'వ్యక్తి', 'Last seen': 'చివరిసారి', 'Device': 'పరికరం',
  'Most tapped': 'ఎక్కువగా నొక్కినవి', 'Pages opened': 'తెరిచిన పేజీలు', 'Recent visits': 'ఇటీవలి సందర్శనలు', 'Click log': 'క్లిక్ లాగ్',
  'Everyone': 'అందరూ', 'Show taps by': 'ఎవరు నొక్కినవి చూపించు', 'Keep the log small': 'లాగ్ చిన్నగా ఉంచండి', 'Opened page': 'పేజీ తెరిచారు',
  'Only signed-in members are counted. Clearing removes visits and taps older than 90 days.': 'సైన్ ఇన్ అయిన సభ్యులనే లెక్కిస్తుంది. 90 రోజుల కంటే పాత సందర్శనలు, నొక్కినవి తొలగించబడతాయి.',
  'Clear entries older than 90 days': '90 రోజుల కంటే పాతవి తొలగించండి', 'Loading the usage log…': 'వినియోగ లాగ్ లోడ్ అవుతోంది…',
  'No visits in this period.': 'ఈ కాలంలో సందర్శనలు లేవు.', 'No taps yet.': 'ఇంకా ఏమీ నొక్కలేదు.', 'No pages opened yet.': 'ఇంకా పేజీలు తెరవలేదు.',
  'No taps in this period.': 'ఈ కాలంలో ఏమీ నొక్కలేదు.',
  'Visits and taps in the app are logged so the treasurer can see how it is used.': 'యాప్ ఎలా వాడుతున్నారో కోశాధికారి చూడటానికి సందర్శనలు, నొక్కినవి నమోదవుతాయి.', 'Amount not added': 'మొత్తం జోడించలేదు', 'Courtesy reminder': 'మర్యాదపూర్వక రిమైండర్',
  'Please pay online, then tap Mark paid. Please ignore if already paid. Thank you!':
    'దయచేసి ఆన్‌లైన్‌లో చెల్లించి, తర్వాత “చెల్లించినట్లు గుర్తించండి” నొక్కండి. ఇప్పటికే చెల్లించి ఉంటే పట్టించుకోకండి. ధన్యవాదాలు!', 'Pay now': 'ఇప్పుడే చెల్లించండి', 'WhatsApp reminder': 'వాట్సాప్ రిమైండర్',
  'Send a courtesy reminder on WhatsApp': 'వాట్సాప్‌లో మర్యాదపూర్వక రిమైండర్ పంపండి', 'tap to mark it paid': 'చెల్లించినట్లు గుర్తించడానికి నొక్కండి',
  'Taxpayer name': 'పన్ను చెల్లింపుదారు పేరు', 'Taxpayer name (as on the GVMC bill)': 'పన్ను చెల్లింపుదారు పేరు (GVMC బిల్లుపై ఉన్నట్లు)',
  'Owner name printed on the tax bill': 'పన్ను బిల్లుపై ఉన్న యజమాని పేరు', 'Due amount': 'చెల్లించాల్సిన మొత్తం', 'Due amount (₹)': 'చెల్లించాల్సిన మొత్తం (₹)', 'Nothing due': 'బకాయి లేదు',
  'Enter the tax amount in rupees (0 to 10,00,000).': 'పన్ను మొత్తాన్ని రూపాయల్లో ఇవ్వండి (0 నుండి 10,00,000).', 'Copy and open the payment page': 'కాపీ చేసి చెల్లింపు పేజీ తెరవండి', 'Online payment link': 'ఆన్‌లైన్ చెల్లింపు లింక్',
  'Copies your assessment number — paste it on the payment page. After paying, come back and tap Mark paid.':
    'మీ అసెస్‌మెంట్ నంబర్ కాపీ అవుతుంది — చెల్లింపు పేజీలో పేస్ట్ చేయండి. చెల్లించిన తర్వాత ఇక్కడికి వచ్చి “చెల్లించినట్లు గుర్తించండి” నొక్కండి.',
  'Add your assessment number first; you will need it on the payment page.': 'ముందుగా మీ అసెస్‌మెంట్ నంబర్ జోడించండి; చెల్లింపు పేజీలో అది అవసరం.',
  'Opens when a flat taps Pay online. Leave empty to hide the button.': 'ఫ్లాట్ వారు “ఆన్‌లైన్‌లో చెల్లించండి” నొక్కినప్పుడు తెరుచుకుంటుంది. బటన్ దాచాలంటే ఖాళీగా వదలండి.',
  'The payment link must start with https://': 'చెల్లింపు లింక్ https:// తో మొదలవ్వాలి',

  // reports
  'Monthly statement': 'నెలవారీ నివేదిక', 'Annual summary': 'వార్షిక సారాంశం', 'Month': 'నెల', 'Monthly': 'నెలవారీ', 'Total': 'మొత్తం',
  'Balance': 'నిల్వ', 'Opening balance': 'ప్రారంభ నిల్వ', 'Expenditure': 'ఖర్చు', 'Total expenditure': 'మొత్తం ఖర్చు', 'Less: expenditure': 'తీసివేత: ఖర్చు',
  'Total available': 'మొత్తం అందుబాటులో', 'By category': 'విభాగాల వారీగా', 'No expenses recorded for this month.': 'ఈ నెల ఖర్చులు నమోదు కాలేదు.',
  'No expenses this year.': 'ఈ సంవత్సరం ఖర్చులు లేవు.', 'Monthly statement in the notebook format. Print or save as PDF to share.': 'నోట్‌బుక్ పద్ధతిలో నెలవారీ నివేదిక. పంచుకోవడానికి ప్రింట్ చేయండి లేదా PDFగా సేవ్ చేయండి.',

  // staff
  'Add staff': 'సిబ్బందిని జోడించండి', 'Pay salary': 'జీతం చెల్లించండి', 'Pay slip': 'పే స్లిప్', 'Salary slip': 'జీతం స్లిప్', 'Duties': 'విధులు',
  'Duties (one per line)': 'విధులు (ఒక్కో లైన్‌లో ఒకటి)', 'Role': 'పాత్ర', 'Phone': 'ఫోన్', 'Working hours': 'పని వేళలు', 'Joined on': 'చేరిన తేదీ',
  'Monthly salary': 'నెల జీతం', 'Monthly salary (₹)': 'నెల జీతం (₹)', 'Salary for month': 'ఏ నెల జీతం', 'Extra / bonus (₹)': 'అదనం / బోనస్ (₹)',
  'Advance / deductions (₹)': 'అడ్వాన్స్ / కోతలు (₹)', 'Net paid:': 'నికర చెల్లింపు:', 'Net': 'నికరం', 'Note on the slip (optional)': 'స్లిప్‌పై గమనిక (ఐచ్ఛికం)',
  'Show duties on the pay slip': 'పే స్లిప్‌పై విధులు చూపించు', 'Salary payment recorded': 'జీతం చెల్లింపు నమోదైంది', 'Staff deleted': 'సిబ్బంది తొలగించబడ్డారు',
  'Expense category for salary': 'జీతం ఖర్చు విభాగం', 'Usual payment mode': 'సాధారణ చెల్లింపు విధానం', 'UPI ID (optional)': 'UPI ID (ఐచ్ఛికం)',
  'Net paid must be more than ₹0. Check the deductions.': 'నికర చెల్లింపు ₹0 కంటే ఎక్కువ ఉండాలి. కోతలు చూడండి.',

  // vendors and notices
  'Add vendor': 'వెండర్‌ను జోడించండి', 'Service': 'సేవ', 'Contact': 'సంప్రదింపు', 'Contract': 'ఒప్పందం', 'Contract amount (₹)': 'ఒప్పందం మొత్తం (₹)',
  'Billing period': 'బిల్లింగ్ కాలం', 'AMC / contract renewal': 'AMC / ఒప్పందం పునరుద్ధరణ', 'Notes': 'గమనికలు', 'No vendors yet.': 'ఇంకా వెండర్లు లేరు.',
  'Vendor deleted': 'వెండర్ తొలగించబడ్డారు', 'Service providers, contract amounts and AMC renewal dates.': 'సేవలు అందించేవారు, ఒప్పంద మొత్తాలు, AMC పునరుద్ధరణ తేదీలు.',
  'Announcements from the association.': 'సంఘం నుండి ప్రకటనలు.', 'Title': 'శీర్షిక', 'Message': 'సందేశం', 'Pin to home page': 'హోమ్ పేజీలో పిన్ చేయండి',
  'No notices yet.': 'ఇంకా ప్రకటనలు లేవు.', 'Notice deleted': 'ప్రకటన తొలగించబడింది',

  // settings
  'Society': 'సొసైటీ', 'Society details, members and data.': 'సొసైటీ వివరాలు, సభ్యులు, డేటా.', 'Society / apartment name': 'సొసైటీ / అపార్ట్‌మెంట్ పేరు',
  'Address': 'చిరునామా', 'Treasurer (shown on statements)': 'కోశాధికారి (నివేదికలపై చూపబడుతుంది)', 'Tracking starts (month)': 'నమోదు ప్రారంభ నెల',
  'Balance brought forward into that month (₹)': 'ఆ నెలకు ముందుకు తెచ్చిన నిల్వ (₹)', 'Financial year starts in': 'ఆర్థిక సంవత్సరం ప్రారంభం',
  'How residents should pay': 'నివాసులు ఎలా చెల్లించాలి', 'Expense categories (one per line)': 'ఖర్చు విభాగాలు (ఒక్కో లైన్‌లో ఒకటి)',
  'Payment modes (one per line)': 'చెల్లింపు విధానాలు (ఒక్కో లైన్‌లో ఒకటి)', 'Monthly bills quick links (one per line)': 'నెలవారీ బిల్లుల క్విక్ లింక్‌లు (ఒక్కో లైన్‌లో ఒకటి)',
  'Shown on Home and Expenses for quick entry each month. Leave empty to hide.': 'ప్రతి నెల త్వరగా నమోదు చేయడానికి హోమ్, ఖర్చుల పేజీలలో కనిపిస్తాయి. దాచాలంటే ఖాళీగా వదలండి.',
  'Settings saved': 'సెట్టింగ్‌లు సేవ్ అయ్యాయి', 'Members': 'సభ్యులు', 'Member updated': 'సభ్యుడి వివరాలు మార్చబడ్డాయి', 'Activity log': 'కార్యకలాపాల లాగ్',
  'No activity yet.': 'ఇంకా కార్యకలాపాలు లేవు.', 'Data': 'డేటా', 'Download backup (JSON)': 'బ్యాకప్ డౌన్‌లోడ్ (JSON)', 'Import data file': 'డేటా ఫైల్ దిగుమతి',
  'Import finished': 'దిగుమతి పూర్తయింది', 'Rename a category': 'విభాగం పేరు మార్చండి', 'New name': 'కొత్త పేరు', 'Type or pick a category': 'విభాగం టైప్ చేయండి లేదా ఎంచుకోండి',
  'Choose the category to rename.': 'పేరు మార్చాల్సిన విభాగం ఎంచుకోండి.', 'Type the new name.': 'కొత్త పేరు టైప్ చేయండి.', 'The new name is the same as the old one.': 'కొత్త పేరు పాత పేరుతో సమానంగా ఉంది.',
  'Fixes a wrongly typed category on every expense at once (and on staff salaries and the list above). Pick a category that already exists to merge the two.':
    'తప్పుగా టైప్ చేసిన విభాగాన్ని అన్ని ఖర్చులపై ఒకేసారి సరిచేస్తుంది (సిబ్బంది జీతాలు, పై జాబితాలో కూడా). రెండింటినీ కలపాలంటే ఇప్పటికే ఉన్న విభాగాన్ని ఎంచుకోండి.',
  'Approve residents and link them to their flat': 'నివాసులను ఆమోదించి వారి ఫ్లాట్‌కు జోడించండి', 'waiting for approval': 'ఆమోదం కోసం వేచి ఉన్నారు',
  'pending': 'పెండింగ్', 'resident': 'నివాసి', 'admin': 'అడ్మిన్', 'Due day must be between 1 and 31.': 'గడువు రోజు 1 నుండి 31 మధ్య ఉండాలి.',
  'Nobody has signed in yet. Share the site link with residents.': 'ఇంకా ఎవరూ సైన్ ఇన్ కాలేదు. నివాసులకు సైట్ లింక్ పంపండి.',

  // sign-in, setup, waiting
  'Your name (only for new accounts)': 'మీ పేరు (కొత్త ఖాతాలకు మాత్రమే)', 'Password': 'పాస్‌వర్డ్', 'Your name': 'మీ పేరు', 'Set up your society': 'మీ సొసైటీని సెటప్ చేయండి',
  'Maintenance per flat each month (₹)': 'ప్రతి నెల ఒక్కో ఫ్లాట్‌కు మెయింటెనెన్స్ (₹)', 'Flat numbers (one per line or comma separated)': 'ఫ్లాట్ నంబర్లు (ఒక్కో లైన్‌లో లేదా కామాతో)',
  'Request sent to the treasurer': 'కోశాధికారికి అభ్యర్థన పంపబడింది', 'The treasurer hasn\'t finished setting up the accounts. Please check back later.': 'కోశాధికారి ఇంకా ఖాతాలు సెటప్ పూర్తి చేయలేదు. తర్వాత మళ్లీ చూడండి.',

  // install steps and other notes
  'Add SVLN to your home screen': 'SVLN ను హోమ్ స్క్రీన్‌కు జోడించండి',
  'Open it from your home screen, like any other app.': 'ఇతర యాప్‌ల లాగే హోమ్ స్క్రీన్ నుండి తెరవండి.',
  'Tap the browser menu ⋮ (top right) → “Install app” or “Add to Home screen”. Opened from WhatsApp? First tap ⋮ → “Open in Chrome”.':
    'బ్రౌజర్ మెనూ ⋮ (పై కుడివైపు) నొక్కండి → “Install app” లేదా “Add to Home screen”. వాట్సాప్ నుండి తెరిచారా? ముందుగా ⋮ → “Open in Chrome” నొక్కండి.',
  'Open this page in Chrome first: tap ⋮ (top right) → “Open in Chrome”. Then tap ⋮ → “Install app” or “Add to Home screen”.':
    'ముందుగా ఈ పేజీని Chrome లో తెరవండి: ⋮ (పై కుడివైపు) → “Open in Chrome”. తర్వాత ⋮ → “Install app” లేదా “Add to Home screen” నొక్కండి.',
  'Tap the Share button ⎙ at the bottom, then “Add to Home Screen” → “Add”.': 'కింద ఉన్న Share బటన్ ⎙ నొక్కండి, తర్వాత “Add to Home Screen” → “Add”.',
  'Open this page in Safari first (tap ⋯ or the compass icon → “Open in Safari”). Then tap Share ⎙ → “Add to Home Screen”.':
    'ముందుగా ఈ పేజీని Safari లో తెరవండి (⋯ లేదా కంపాస్ గుర్తు → “Open in Safari”). తర్వాత Share ⎙ → “Add to Home Screen” నొక్కండి.',
  'Use “View as” at the top to switch between the treasurer and a resident. Try anything — changes are not saved and reset when you reload.':
    'కోశాధికారి, నివాసి మధ్య మారడానికి పైన “ఇలా చూడండి” వాడండి. ఏదైనా ప్రయత్నించండి — మార్పులు సేవ్ కావు, రీలోడ్ చేస్తే మళ్లీ మొదటికి వస్తాయి.',
  'Months before “Applies from” keep the amount they had, so past dues don\'t change.': '“ఏ నెల నుండి వర్తిస్తుంది” కంటే ముందు నెలలకు పాత మొత్తమే ఉంటుంది, కాబట్టి పాత బకాయిలు మారవు.',
  'Download a full backup, or import a data file (for example an earlier month from the notebook). Imported records with the same ID replace existing ones.':
    'పూర్తి బ్యాకప్ డౌన్‌లోడ్ చేయండి, లేదా డేటా ఫైల్ దిగుమతి చేయండి (ఉదా. నోట్‌బుక్ నుండి పాత నెల). ఒకే ID ఉన్న రికార్డులు పాత వాటిని మారుస్తాయి.',
  'No one has signed in yet': 'ఇంకా ఎవరూ సైన్ ఇన్ కాలేదు', 'Approve': 'ఆమోదించండి', 'No payment recorded': 'చెల్లింపు నమోదు కాలేదు',
  'Receipts (maintenance collected)': 'వసూళ్లు (మెయింటెనెన్స్)', 'Contact details and duties.': 'సంప్రదింపు వివరాలు, విధులు.',
  'Contact details and duties, salary payments and pay slips.': 'సంప్రదింపు వివరాలు, విధులు, జీతం చెల్లింపులు, పే స్లిప్‌లు.',

  // sign-in errors (util.js AUTH_MESSAGES)
  'Email or password is wrong. New here? Use Create account.': 'ఈమెయిల్ లేదా పాస్‌వర్డ్ తప్పు. కొత్తవారా? ఖాతా సృష్టించండి వాడండి.',
  'Wrong password. Try again.': 'పాస్‌వర్డ్ తప్పు. మళ్లీ ప్రయత్నించండి.', 'Password must be at least 6 characters.': 'పాస్‌వర్డ్ కనీసం 6 అక్షరాలు ఉండాలి.',
  'No internet connection. Check your network and try again.': 'ఇంటర్నెట్ కనెక్షన్ లేదు. నెట్‌వర్క్ చూసి మళ్లీ ప్రయత్నించండి.',
  'You don\'t have permission to do that.': 'దీనికి మీకు అనుమతి లేదు.',
};

// Text with numbers or names inside. Each returns the Telugu sentence; English month names in the
// result are translated afterwards.
const t = s => TE[s] || s;
const PATTERNS = [
  [/^(\d+) (?:people|person) online now$/, (_, n) => `ఇప్పుడు ${n} మంది ఆన్‌లైన్‌లో`],
  [/^Flat (\S+)$/, (_, f) => `ఫ్లాట్ ${f}`],
  [/^(\d+) monthly instalments$/, (_, n) => `${n} నెలవారీ వాయిదాలు`],
  [/^Instalment (\d+) of (\d+)$/, (_, a, b) => `${b} లో ${a}వ వాయిదా`],
  [/^Instalment (\d+)$/, (_, a) => `${a}వ వాయిదా`],
  [/^(₹[\d,]+) pending$/, (_, a) => `${a} పెండింగ్`],
  [/^(₹[\d,]+) of (₹[\d,]+) collected$/, (_, a, b) => `${b} లో ${a} వసూలైంది`],
  [/^Paid by owners · waiting for approval \((\d+)\)$/, (_, n) => `యజమానులు చెల్లించినవి · ఆమోదం కోసం (${n})`],
  [/^Approve & split · Flat (\S+)$/, (_, f) => `ఆమోదించి పంచండి · ఫ్లాట్ ${f}`],
  [/^Today's backup saved: (.+)$/, (_, f) => `ఈరోజు బ్యాకప్ సేవ్ అయింది: ${f}`],
  [/^Already added this month: (.+) on (.+)$/, (_, a, d) => `ఈ నెల ఇప్పటికే చేర్చారు: ${d} న ${a}`],
  [/^(\d+) of (\d+) flats have added their Service Number$/, (_, a, b) => `${b} లో ${a} ఫ్లాట్లు సర్వీస్ నంబర్ చేర్చాయి`],
  [/^Copy reminders \((\d+)\)$/, (_, n) => `రిమైండర్లు కాపీ చేయండి (${n})`],
  [/^Bill history (\d{4}-\d{4})$/, (_, y) => `బిల్లుల చరిత్ర ${y}`],
  [/^Electricity · Flat (\S+)$/, (_, f) => `కరెంట్ · ఫ్లాట్ ${f}`],
  [/^Service Number (\S+) copied — paste it on the bill page$/, (_, n) => `సర్వీస్ నంబర్ ${n} కాపీ అయింది — బిల్లు పేజీలో పేస్ట్ చేయండి`],
  [/^Split expense collected: (.+)$/, (_, t) => `పంచుకునే ఖర్చు వసూలు: ${t}`],
  [/^Pay full balance (.+)$/, (_, a) => `మొత్తం బాకీ ${a} చెల్లించండి`],
  [/^Alert · Flat (\S+)$/, (_, f) => `అలర్ట్ · ఫ్లాట్ ${f}`],
  [/^Individual alerts on: Flats? (.+)$/, (_, f) => `ప్రత్యేక అలర్ట్‌లు: ఫ్లాట్ ${f}`],
  [/^until (.+)$/, (_, d) => `${d} వరకు`],
  [/^Today: (\d+)$/, (_, n) => `ఈరోజు: ${n}`],
  [/^Pages opened: (\d+)$/, (_, n) => `తెరిచిన పేజీలు: ${n}`],
  [/^Cleared (\d+) old entr(?:y|ies)$/, (_, n) => `${n} పాత ఎంట్రీలు తొలగించబడ్డాయి`],
  [/^This is a courtesy reminder: house tax for (.+) (is|was) due on (.+)\.$/, (_, l, w, d) =>
    `ఇది మర్యాదపూర్వక రిమైండర్: ${t(l)} ఇంటి పన్ను ${w === 'was' ? `${d}న గడువు ముగిసింది` : `${d}లోగా చెల్లించాలి`}.`],
  [/^Assessment No: (.+)$/, (_, n) => `అసెస్‌మెంట్ నం: ${n}`],
  [/^Taxpayer: (.+)$/, (_, n) => `పన్ను చెల్లింపుదారు: ${n}`],
  [/^Due amount: (.+)$/, (_, a) => `చెల్లించాల్సిన మొత్తం: ${a}`],
  [/^Tax due: (.+)$/, (_, a) => `చెల్లించాల్సిన పన్ను: ${a}`],
  [/^Penalty \(added by GVMC\): (.+)$/, (_, a) => `పెనాల్టీ (GVMC జోడించినది): ${a}`],
  [/^Total due: (.+)$/, (_, a) => `మొత్తం చెల్లించాల్సింది: ${a}`],
  [/^(₹[\d,]+) incl\. (₹[\d,]+) penalty$/, (_, a, b) => `${a} (${b} పెనాల్టీతో కలిపి)`],
  [/^Assessment number (.+) copied — paste it on the payment page$/, (_, n) => `అసెస్‌మెంట్ నంబర్ ${n} కాపీ అయింది — చెల్లింపు పేజీలో పేస్ట్ చేయండి`],
  [/^\(Flat (\S+)\)$/, (_, f) => `(ఫ్లాట్ ${f})`],
  [/^Flat (\S+): all dues paid$/, (_, f) => `ఫ్లాట్ ${f}: అన్ని బకాయిలు చెల్లించారు`],
  [/^(₹[\d,]+) due for Flat (\S+)$/, (_, a, f) => `ఫ్లాట్ ${f}కు ${a} బకాయి`],
  [/^(₹[\d,]+) pending$/, (_, a) => `${a} పెండింగ్`],
  [/^(Collected|Spent) · (.+)$/, (_, k, m) => `${t(k)} · ${m}`],
  [/^Brought forward (₹[\d,]+)$/, (_, a) => `ముందుకు తెచ్చినది ${a}`],
  [/^Collected (₹[\d,]+)$/, (_, a) => `వసూలు ${a}`],
  [/^Due in (\d+) days?$/, (_, n) => `${n} రోజుల్లో గడువు`],
  [/^Overdue by (\d+) days?$/, (_, n) => `${n} రోజులు గడువు దాటింది`],
  [/^Paid (₹[\d,]+ )?on (.+)$/, (_, a, d) => `${d}న ${a || ''}చెల్లించారు`],
  [/^Due (\d.+)$/, (_, d) => `గడువు ${d}`],
  [/^(₹[\d,.]+(?:\/sq\. ft\.)?) per flat each month · due by the (\d+)\w\w$/, (_, a, d) => `ప్రతి నెల ఒక్కో ఫ్లాట్‌కు ${a} · ప్రతి నెల ${d}వ తేదీలోగా`],
  [/^due (\d.+)$/, (_, d) => `గడువు ${d}`],
  [/^Flats (\d.*)$/, (_, f) => `ఫ్లాట్లు ${f}`],
  [/^(₹[\d,]+) still to pay$/, (_, a) => `ఇంకా ${a} చెల్లించాలి`],
  [/^Assessment No\. (.+)$/, (_, no) => `అసెస్‌మెంట్ నం. ${no}`],
  [/^(\d+) instalments? due — add the amount$/, (_, n) => `${n} వాయిదా(లు) బకాయి — మొత్తం జోడించండి`],
  [/^House tax due in (\d+) days? · (.+)$/, (_, n, d) => `ఇంటి పన్ను ${n} రోజుల్లో గడువు · ${d}`],
  [/^House tax due today$/, () => 'ఇంటి పన్ను గడువు ఈరోజే'],
  [/^House tax overdue · was due (.+)$/, (_, d) => `ఇంటి పన్ను గడువు దాటింది · గడువు ${d}`],
  [/^House tax (?:due in (\d+) days?|overdue|due today): (\d+) of (\d+) flats not marked paid$/, (m, n, a, b) =>
    `ఇంటి పన్ను ${n ? `${n} రోజుల్లో గడువు` : m.includes('overdue') ? 'గడువు దాటింది' : 'గడువు ఈరోజే'}: ${b} ఫ్లాట్లలో ${a} చెల్లించినట్లు గుర్తించలేదు`],
  [/^Reminders start (\d+) days before each due date$/, (_, n) => `ప్రతి గడువుకు ${n} రోజుల ముందు రిమైండర్లు మొదలవుతాయి`],
  [/^✓ Paid (₹[\d,]+) · (.+)$/, (_, a, d) => `✓ ${a} చెల్లించారు · ${d}`],
  [/^(.+) · tap to add$/, (_, m) => `${m} · జోడించడానికి నొక్కండి`],
  [/^Add expense · (.+)$/, (_, l) => `ఖర్చు జోడించండి · ${l}`],
  [/^House tax · Flat (\S+)$/, (_, f) => `ఇంటి పన్ను · ఫ్లాట్ ${f}`],
  [/^House tax paid · Flat (\S+)$/, (_, f) => `ఇంటి పన్ను చెల్లింపు · ఫ్లాట్ ${f}`],
  [/^(\d+) expenses?$/, (_, n) => `${n} ${n === '1' ? 'ఖర్చు' : 'ఖర్చులు'}`],
  [/^(.+) \((\d+) expenses?\)$/, (_, c, n) => `${c} (${n} ${n === '1' ? 'ఖర్చు' : 'ఖర్చులు'})`],
  [/^(.+) · approve in Settings → Members$/, (_, w) => `${w} · సెట్టింగ్‌లు → సభ్యులు లో ఆమోదించండి`],
  [/^(.+) · (Collected|Spent): (.+)$/, (_, m, k, a) => `${m} · ${t(k)}: ${a}`],
  [/^(\d+) flats? · (₹[\d,]+) pending$/, (_, n, a) => `${n} ఫ్లాట్లు · ${a} పెండింగ్`],
  [/^Asks for Flat (\S+)$/, (_, f) => `ఫ్లాట్ ${f} కోసం అడుగుతున్నారు`],
  [/^Receipts \(@ (₹[\d,]+) × (\d+)\)$/, (_, a, n) => `వసూళ్లు (@ ${a} × ${n})`],
  [/^Balance from (.+)$/, (_, m) => `${m} నుండి నిల్వ`],
  [/^Balance carried to (.+) maintenance$/, (_, m) => `${m} మెయింటెనెన్స్‌కు ముందుకు నిల్వ`],
  [/^(\d+) of (\d+) flats paid (.+) maintenance$/, (_, a, b, m) => `${m} మెయింటెనెన్స్: ${b}లో ${a} ఫ్లాట్లు చెల్లించాయి`],
  [/^Prepared by (.+) · (.+)$/, (_, w, d) => `తయారు చేసినవారు ${w} · ${d}`],
  [/^(.+) · since (.+)$/, (_, r, d) => `${r} · ${d} నుండి`],
  [/^(.+) not paid$/, (_, m) => `${m} చెల్లించలేదు`],
  [/^(.+) · 📌 Pinned$/, (_, d) => `${d} · 📌 పిన్ చేయబడింది`],
  [/^(.+) · tap to see details$/, (_, m) => `${m} · వివరాల కోసం నొక్కండి`],
  [/^Your flat details are (\d+)% complete$/, (_, n) => `మీ ఫ్లాట్ వివరాలు ${n}% పూర్తయ్యాయి`],
  [/^Still needed: (.+)\.$/, (_, l) => `ఇంకా కావాల్సినవి: ${l.split(', ').map(t).join(', ')}.`],
  [/^\((.+)\)\. Family members can sign in with their own accounts; the treasurer links them to this flat\.$/, (_, e) =>
    `(${e}). కుటుంబ సభ్యులు తమ సొంత ఖాతాలతో సైన్ ఇన్ కావచ్చు; కోశాధికారి వారిని ఈ ఫ్లాట్‌కు జోడిస్తారు.`],
  [/^Updated (.+?)(?: by (.+))?\. Phone numbers are visible only to this flat and the treasurer\.$/, (_, d, w) =>
    `${d}న ${w ? w + ' ' : ''}మార్చారు. ఫోన్ నంబర్లు ఈ ఫ్లాట్ మరియు కోశాధికారికి మాత్రమే కనిపిస్తాయి.`],
  [/^(₹[\d,]+) on (\d.+?)(?: \((.+)\))?$/, (_, a, d, m) => `${d}న ${a}${m ? ` (${m})` : ''}`],
  [/^Renamed on (\d+) expenses?$/, (_, n) => `${n} ఖర్చులపై పేరు మార్చబడింది`],
  [/^No expenses recorded in (.+) yet\.$/, (_, m) => `${m}లో ఇంకా ఖర్చులు నమోదు కాలేదు.`],
  [/^spent in (.+)$/, (_, m) => `${m}లో ఖర్చు`],
  [/^Whole year (.+)$/, (_, y) => `పూర్తి సంవత్సరం ${y}`],
  [/^(\d+) (?:person is|people are) waiting for approval$/, (_, n) => `${n} మంది ఆమోదం కోసం వేచి ఉన్నారు`],
  [/^Flat details: (\d+) of (\d+) complete$/, (_, a, b) => `ఫ్లాట్ వివరాలు: ${b}లో ${a} పూర్తి`],
  [/^(\d+) details? missing$/, (_, n) => `${n} వివరాలు లేవు`],
  [/^(\d+)% complete$/, (_, n) => `${n}% పూర్తి`],
  [/^Flats \((\d+)\)$/, (_, n) => `ఫ్లాట్లు (${n})`],
  [/^Last (\d+) changes$/, (_, n) => `చివరి ${n} మార్పులు`],
  [/^(.+) per month, due by the (\d+)\w\w$/, (_, a, d) => `నెలకు ${a}, ప్రతి నెల ${d}వ తేదీలోగా`],
];

const MONTHS = {
  January: 'జనవరి', February: 'ఫిబ్రవరి', March: 'మార్చి', April: 'ఏప్రిల్', May: 'మే', June: 'జూన్', July: 'జూలై',
  August: 'ఆగస్టు', September: 'సెప్టెంబర్', October: 'అక్టోబర్', November: 'నవంబర్', December: 'డిసెంబర్',
  Jan: 'జన', Feb: 'ఫిబ్ర', Mar: 'మార్చి', Apr: 'ఏప్రి', Jun: 'జూన్', Jul: 'జూలై', Aug: 'ఆగ', Sep: 'సెప్టెం', Sept: 'సెప్టెం', Oct: 'అక్టో', Nov: 'నవం', Dec: 'డిసెం',
};
const MONTH_RE = new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\b`, 'g');
const months = s => s.replace(MONTH_RE, m => MONTHS[m]);

// Translate one string (keeping its surrounding spaces); null when there is nothing to change.
export function translate(text) {
  const core = text.trim();
  if (!core || !/[A-Za-z]/.test(core)) return null;
  let out = TE[core];
  if (out === undefined) for (const [re, fn] of PATTERNS) { const m = core.match(re); if (m) { out = fn(...m); break; } }
  if (out === undefined && core.includes(' · ')) {
    const parts = core.split(' · ').map(x => translate(x) ?? x);
    out = parts.join(' · ');
  }
  out = months(out ?? core);
  return out === core ? null : text.replace(core, out);
}

const SKIP = 'script, style, textarea, [translate="no"], .svln-loader';
const ATTRS = ['placeholder', 'aria-label', 'title'];

function translateNode(node) {
  if (node.nodeType === 3) {
    const el = node.parentElement;
    if (!el || el.closest(SKIP)) return;
    // An <option> without a value submits its text: keep the English value before translating it.
    if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent);
    const out = translate(node.nodeValue);
    if (out !== null) node.nodeValue = out;
    return;
  }
  if (node.nodeType !== 1 || node.closest(SKIP)) return;
  for (const el of [node, ...node.querySelectorAll('*')]) {
    for (const a of ATTRS) if (el.hasAttribute(a)) { const v = TE[el.getAttribute(a)]; if (v) el.setAttribute(a, v); }
  }
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walk.nextNode()) texts.push(walk.currentNode);
  texts.forEach(translateNode);
}

// Start translating the page now and everything drawn later (pages, dialogs, toasts).
export function startTelugu() {
  document.documentElement.lang = 'te';
  document.documentElement.classList.add('lang-te');
  translateNode(document.body);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
