-- ============================================================================
--  questions-french.sql — Adds French translations for all trivia questions
--
--  HOW TO USE:
--    1. Go to supabase.com -> your project -> "SQL Editor"
--    2. Paste this whole file and click RUN
--    3. This is SAFE TO RE-RUN (idempotent)
--
--  Adds question_fr and options_fr columns to the questions table,
--  then populates French translations for all 480 questions.
-- ============================================================================

-- ============================================================================
--  STEP 1: Add French columns to the questions table
-- ============================================================================
DO $$
begin
  -- Add question_fr column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'question_fr'
  ) then
    alter table public.questions add column question_fr text;
  end if;

  -- Add options_fr column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'options_fr'
  ) then
    alter table public.questions add column options_fr text[];
  end if;
end;
$$;


-- ============================================================================
--  STEP 2: Populate French translations for all questions
-- ============================================================================

-- SCIENCE
UPDATE public.questions SET
  question_fr = 'Quel est la planète la plus proche du Soleil ?',
  options_fr = ARRAY['Mercure', 'Vénus', 'Terre', 'Mars']
WHERE question = 'What is the closest planet to the Sun?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel gaz compose environ 78 % de l''atmosphère terrestre ?',
  options_fr = ARRAY['Oxygène', 'Azote', 'Dioxyde de carbone', 'Argon']
WHERE question = 'What gas makes up about 78% of Earth''s atmosphere?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus grand organe du corps humain ?',
  options_fr = ARRAY['Foie', 'Peau', 'Cerveau', 'Cœur']
WHERE question = 'What is the largest organ of the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude des conditions météorologiques ?',
  options_fr = ARRAY['Géologie', 'Astronomie', 'Météorologie', 'Écologie']
WHERE question = 'What is the study of weather called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le point d''ébullition de l''eau au niveau de la mer ?',
  options_fr = ARRAY['90°C', '100°C', '110°C', '120°C']
WHERE question = 'What is the boiling point of water at sea level?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de cœurs a une pieuvre ?',
  options_fr = ARRAY['Un', 'Deux', 'Trois', 'Quatre']
WHERE question = 'How many hearts does an octopus have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la plus petite unité du vivant ?',
  options_fr = ARRAY['Atome', 'Molécule', 'Cellule', 'Tissu']
WHERE question = 'What is the smallest unit of life?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est l''élément le plus abondant de l''univers ?',
  options_fr = ARRAY['Hélium', 'Oxygène', 'Carbone', 'Hydrogène']
WHERE question = 'What is the most abundant element in the universe?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète est célèbre pour ses anneaux spectaculaires ?',
  options_fr = ARRAY['Jupiter', 'Neptune', 'Saturne', 'Uranus']
WHERE question = 'Which planet is famous for its spectacular rings?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle partie de la cellule contrôle ses activités ?',
  options_fr = ARRAY['Cytoplasme', 'Noyau', 'Membrane', 'Ribosome']
WHERE question = 'Which part of the cell controls its activities?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude scientifique des oiseaux ?',
  options_fr = ARRAY['Entomologie', 'Ichtyologie', 'Ornithologie', 'Herpétologie']
WHERE question = 'What is the scientific study of birds called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien d''os contient une main humaine adulte ?',
  options_fr = ARRAY['24', '27', '30', '21']
WHERE question = 'How many bones are in a single adult human hand?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la vitesse approximative du son dans l''air ?',
  options_fr = ARRAY['343 m/s', '100 m/s', '700 m/s', '1200 m/s']
WHERE question = 'What is the approximate speed of sound in air?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète tourne sur le côté ?',
  options_fr = ARRAY['Neptune', 'Uranus', 'Saturne', 'Mercure']
WHERE question = 'Which planet rotates on its side?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle vitamine aide le corps à produire la lumière du soleil ?',
  options_fr = ARRAY['Vitamine A', 'Vitamine B12', 'Vitamine C', 'Vitamine D']
WHERE question = 'Which vitamin does sunlight help the body produce?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la substance naturelle la plus dure sur Terre ?',
  options_fr = ARRAY['Quartz', 'Diamant', 'Or', 'Fer']
WHERE question = 'What is the hardest natural substance on Earth?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel type d''animal est un dauphin ?',
  options_fr = ARRAY['Poisson', 'Reptile', 'Mammifère', 'Amphibien']
WHERE question = 'What type of animal is a dolphin?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le point de congélation de l''eau en Fahrenheit ?',
  options_fr = ARRAY['0°F', '32°F', '100°F', '212°F']
WHERE question = 'What is the freezing point of water in Fahrenheit?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète est connue sous le nom d''Étoile du matin ?',
  options_fr = ARRAY['Vénus', 'Mars', 'Mercure', 'Jupiter']
WHERE question = 'Which planet is known as the Morning Star?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Que collectent les abeilles pour faire le miel ?',
  options_fr = ARRAY['Pollen', 'Nectar', 'Eau', 'Sève']
WHERE question = 'What do honeybees collect to make honey?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique de l''or ?',
  options_fr = ARRAY['Go', 'Ag', 'Au', 'Gd']
WHERE question = 'What is the chemical symbol for gold?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude scientifique des plantes ?',
  options_fr = ARRAY['Zoologie', 'Botanique', 'Géologie', 'Astronomie']
WHERE question = 'What is the scientific study of plants called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel gaz les plantes libèrent-elles lors de la photosynthèse ?',
  options_fr = ARRAY['Hydrogène', 'Dioxyde de carbone', 'Azote', 'Oxygène']
WHERE question = 'Which gas do plants release during photosynthesis?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus grand mammifère du monde ?',
  options_fr = ARRAY['Éléphant', 'Baleine bleue', 'Girafe', 'Orque']
WHERE question = 'What is the largest mammal in the world?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de dents a un humain adulte en bonne santé ?',
  options_fr = ARRAY['28', '32', '36', '30']
WHERE question = 'How many teeth does a healthy adult human have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on le centre d''un atome ?',
  options_fr = ARRAY['Proton', 'Couche électronique', 'Noyau', 'Orbite']
WHERE question = 'What is the center of an atom called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel groupe sanguin est le donneur universel ?',
  options_fr = ARRAY['O négatif', 'AB positif', 'A positif', 'B négatif']
WHERE question = 'Which blood type is the universal donor?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude de la structure solide de la Terre ?',
  options_fr = ARRAY['Biologie', 'Météorologie', 'Astronomie', 'Géologie']
WHERE question = 'What is the study of the Earth''s solid structure called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus grand animal terrestre ?',
  options_fr = ARRAY['Éléphant d''Afrique', 'Rhinocéros blanc', 'Girafe', 'Hippopotame']
WHERE question = 'What is the largest land animal?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique du sodium ?',
  options_fr = ARRAY['So', 'Na', 'Sd', 'Nm']
WHERE question = 'What is the chemical symbol for sodium?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de temps faut-il à la Terre pour orbiter autour du Soleil ?',
  options_fr = ARRAY['24 heures', '30 jours', '365 jours', '7 jours']
WHERE question = 'How long does it take Earth to orbit the Sun?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''étoile la plus brillante du ciel nocturne terrestre ?',
  options_fr = ARRAY['Bételgeuse', 'Polaris', 'Véga', 'Sirius']
WHERE question = 'What is the brightest star in Earth''s night sky?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est l''ingrédient principal utilisé pour fabriquer le verre ?',
  options_fr = ARRAY['Argile', 'Sable', 'Chaux', 'Sel']
WHERE question = 'What is the main ingredient used to make glass?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quels globules sanguins combattent l''infection ?',
  options_fr = ARRAY['Globules rouges', 'Globules blancs', 'Plaquettes', 'Plasma']
WHERE question = 'Which blood cells fight infection?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on un bébé grenouille ?',
  options_fr = ARRAY['Chiot', 'Têtard', 'Ourson', 'Poussin']
WHERE question = 'What is a baby frog called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel métal est liquide à température ambiante ?',
  options_fr = ARRAY['Fer', 'Cuivre', 'Mercure', 'Aluminium']
WHERE question = 'Which metal is liquid at room temperature?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus grand organe interne du corps humain ?',
  options_fr = ARRAY['Foie', 'Poumons', 'Estomac', 'Reins']
WHERE question = 'What is the largest internal organ in the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on les animaux qui ne mangent que des plantes ?',
  options_fr = ARRAY['Carnivores', 'Omnivores', 'Herbivores', 'Insectivores']
WHERE question = 'What do we call animals that only eat plants?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on un groupe de loups ?',
  options_fr = ARRAY['Meute', 'Troupeau', 'Volée', 'Pride']
WHERE question = 'What is the name for a group of wolves?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel phénomène naturel cause les marées océaniques ?',
  options_fr = ARRAY['Vent', 'Séismes', 'La gravité de la Laleur', 'La chaleur du Soleil']
WHERE question = 'What natural phenomenon causes ocean tides?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète a la Grande Tache Rouge ?',
  options_fr = ARRAY['Saturne', 'Jupiter', 'Mars', 'Neptune']
WHERE question = 'Which planet has the Great Red Spot?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la formule chimique du sel de table ?',
  options_fr = ARRAY['KCl', 'NaCl', 'CaCl2', 'MgO']
WHERE question = 'What is the chemical formula for table salt?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de pattes a un insecte ?',
  options_fr = ARRAY['Huit', 'Quatre', 'Six', 'Dix']
WHERE question = 'How many legs does an insect have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude de la vie ancienne à travers les fossiles ?',
  options_fr = ARRAY['Archéologie', 'Anthropologie', 'Géologie', 'Paléontologie']
WHERE question = 'What is the study of ancient life through fossils called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''unité du courant électrique ?',
  options_fr = ARRAY['Volt', 'Watt', 'Ampère', 'Ohm']
WHERE question = 'What is the unit of electric current?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel organe pompe le sang dans tout le corps ?',
  options_fr = ARRAY['Cerveau', 'Poumons', 'Foie', 'Cœur']
WHERE question = 'Which organ pumps blood around the body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on la couche externe de la Terre ?',
  options_fr = ARRAY['Manteau', 'Croûte', 'Noyau', 'Magma']
WHERE question = 'What is the outermost layer of the Earth called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel type de scientifique étudie les étoiles et les planètes ?',
  options_fr = ARRAY['Géologue', 'Botaniste', 'Entomologiste', 'Astronome']
WHERE question = 'What kind of scientist studies stars and planets?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est l''animal terrestre le plus rapide ?',
  options_fr = ARRAY['Lion', 'Guépard', 'Cheval', 'Lévrier']
WHERE question = 'What is the fastest land animal?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique du fer ?',
  options_fr = ARRAY['Fe', 'Ir', 'I', 'F']
WHERE question = 'What is the chemical symbol for iron?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien d''yeux a une abeille ?',
  options_fr = ARRAY['Deux', 'Trois', 'Cinq', 'Huit']
WHERE question = 'How many eyes does a honeybee have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est l''os le plus long du corps humain ?',
  options_fr = ARRAY['Tibia', 'Fémur', 'Humérus', 'Radius']
WHERE question = 'What is the longest bone in the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Lequel de ces éléments n''est PAS un état de la matière ?',
  options_fr = ARRAY['Solide', 'Liquide', 'Énergie', 'Gaz']
WHERE question = 'Which of these is NOT a state of matter?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on la galaxie qui contient la Terre ?',
  options_fr = ARRAY['Andromède', 'Voie lactée', 'Sombrero', 'Tourbillon']
WHERE question = 'What is the name of the galaxy that contains Earth?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel processus les plantes utilisent-elles pour fabriquer leur propre nourriture ?',
  options_fr = ARRAY['Respiration', 'Digestion', 'Fermentation', 'Photosynthèse']
WHERE question = 'What process do plants use to make their own food?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la planète la plus chaude de notre système solaire ?',
  options_fr = ARRAY['Mercure', 'Mars', 'Vénus', 'Jupiter']
WHERE question = 'What is the hottest planet in our solar system?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le pH de l''eau pure ?',
  options_fr = ARRAY['7', '1', '10', '14']
WHERE question = 'What is the pH of pure water?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude de l''origine et de la structure de l''univers ?',
  options_fr = ARRAY['Cartographie', 'Cosmologie', 'Éthologie', 'Géologie']
WHERE question = 'What is the study of the origin and structure of the universe called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quels organes filtrent le sang pour produire l''urine ?',
  options_fr = ARRAY['Foie', 'Vessie', 'Reins', 'Pancréas']
WHERE question = 'Which organs filter blood to produce urine?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique de l''oxygène ?',
  options_fr = ARRAY['Og', 'Os', 'Ox', 'O']
WHERE question = 'What is the chemical symbol for oxygen?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de chromosomes ont les humains au total ?',
  options_fr = ARRAY['23', '44', '46', '48']
WHERE question = 'How many chromosomes do humans have in total?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on les animaux qui ont une colonne vertébrale ?',
  options_fr = ARRAY['Invertébrés', 'Vertébrés', 'Mammifères', 'Amphibiens']
WHERE question = 'What are animals with backbones called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude des volcans ?',
  options_fr = ARRAY['Sismologie', 'Météorologie', 'Géologie', 'Volcanologie']
WHERE question = 'What is the study of volcanoes called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète est la plus proche de la Terre en taille ?',
  options_fr = ARRAY['Mars', 'Vénus', 'Mercure', 'Neptune']
WHERE question = 'Which planet is closest in size to Earth?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''unité de force ?',
  options_fr = ARRAY['Joule', 'Watt', 'Newton', 'Pascal']
WHERE question = 'What is the unit of force?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'En quoi les chenilles se transforment-elles ?',
  options_fr = ARRAY['Papillons', 'Coléoptères', 'Araignées', 'Vers']
WHERE question = 'What do caterpillars turn into?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le nom scientifique de l''espèce humaine ?',
  options_fr = ARRAY['Homo erectus', 'Homo sapiens', 'Homo habilis', 'Homo neanderthalensis']
WHERE question = 'What is the scientific name for the human species?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien d''éléments différents composent l''eau ?',
  options_fr = ARRAY['Un', 'Trois', 'Deux', 'Quatre']
WHERE question = 'How many different elements make up water?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le nom du satellite naturel de la Terre ?',
  options_fr = ARRAY['Titan', 'Europe', 'Phobos', 'La Lune']
WHERE question = 'What is the name of Earth''s natural satellite?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel type d''énergie possède une voiture en mouvement ?',
  options_fr = ARRAY['Nucléaire', 'Potentielle', 'Chimique', 'Cinétique']
WHERE question = 'What type of energy does a moving car have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle partie du cerveau contrôle l''équilibre et la coordination ?',
  options_fr = ARRAY['Cervelet', 'Cervelet', 'Tronc cérébral', 'Amygdale']
WHERE question = 'Which part of the brain controls balance and coordination?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique du carbone ?',
  options_fr = ARRAY['C', 'Ca', 'Co', 'Cn']
WHERE question = 'What is the chemical symbol for carbon?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la plus petite planète de notre système solaire ?',
  options_fr = ARRAY['Pluton', 'Mars', 'Mercure', 'Vénus']
WHERE question = 'What is the smallest planet in our solar system?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude des insectes ?',
  options_fr = ARRAY['Ornithologie', 'Herpétologie', 'Ichtyologie', 'Entomologie']
WHERE question = 'What is the study of insects called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la température moyenne du corps humain ?',
  options_fr = ARRAY['40°C', '37°C', '35°C', '32°C']
WHERE question = 'What is the average core temperature of the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le premier élément du tableau périodique ?',
  options_fr = ARRAY['Hélium', 'Lithium', 'Hydrogène', 'Oxygène']
WHERE question = 'What is the first element on the periodic table?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel animal peut changer de couleur pour se fondre dans son environnement ?',
  options_fr = ARRAY['Chameau', 'Pingouin', 'Koala', 'Caméléon']
WHERE question = 'Which animal can change color to blend into its surroundings?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on la couche de gaz qui entoure la Terre ?',
  options_fr = ARRAY['Hydrosphère', 'Atmosphère', 'Lithosphère', 'Biosphère']
WHERE question = 'What is the layer of gases surrounding Earth called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''unité d''énergie ?',
  options_fr = ARRAY['Volt', 'Ampère', 'Joule', 'Ohm']
WHERE question = 'What is the unit of energy?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel type d''animal est une chauve-souris ?',
  options_fr = ARRAY['Oiseau', 'Reptile', 'Mammifère', 'Amphibien']
WHERE question = 'What kind of animal is a bat?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on lorsque l''eau se transforme en vapeur ?',
  options_fr = ARRAY['Condensation', 'Évaporation', 'Précipitation', 'Gel']
WHERE question = 'What is it called when water turns into vapor?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel element a le symbole chimique « He » ?',
  options_fr = ARRAY['Hydrogène', 'Néon', 'Lithium', 'Hélium']
WHERE question = 'Which element has the chemical symbol "He"?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus grand oiseau du monde ?',
  options_fr = ARRAY['Aigle', 'Émeu', 'Autruche', 'Albatros']
WHERE question = 'What is the largest bird in the world?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude des séismes ?',
  options_fr = ARRAY['Volcanologie', 'Météorologie', 'Géologie', 'Sismologie']
WHERE question = 'What is the study of earthquakes called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel gaz les plantes absorbent-elles lors de la photosynthèse ?',
  options_fr = ARRAY['Oxygène', 'Azote', 'Dioxyde de carbone', 'Méthane']
WHERE question = 'Which gas do plants take in during photosynthesis?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la plus grande artère du corps humain ?',
  options_fr = ARRAY['Aorte', 'Veine pulmonaire', 'Veine cave', 'Artère carotide']
WHERE question = 'What is the largest artery in the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'De quelle couleur est la langue d''une girafe ?',
  options_fr = ARRAY['Rose', 'Noir-violet', 'Rouge vif', 'Orange']
WHERE question = 'What color is a giraffe''s tongue?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la deuxième planète du Soleil ?',
  options_fr = ARRAY['Mercure', 'Terre', 'Vénus', 'Mars']
WHERE question = 'What is the second planet from the Sun?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''unité de résistance électrique ?',
  options_fr = ARRAY['Volt', 'Ampère', 'Watt', 'Ohm']
WHERE question = 'What is the unit of electrical resistance?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle vitamine est aussi connue sous le nom d''acide ascorbique ?',
  options_fr = ARRAY['Vitamine D', 'Vitamine B12', 'Vitamine A', 'Vitamine C']
WHERE question = 'Which vitamin is also known as ascorbic acid?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude scientifique des animaux ?',
  options_fr = ARRAY['Botanique', 'Zoologie', 'Géologie', 'Astronomie']
WHERE question = 'What is the scientific study of animals called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de planètes compte notre système solaire ?',
  options_fr = ARRAY['Sept', 'Neuf', 'Huit', 'Dix']
WHERE question = 'How many planets are there in our solar system?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la principale source d''énergie pour la vie sur Terre ?',
  options_fr = ARRAY['La Lune', 'Le Soleil', 'L''énergie nucléaire', 'La chaleur géothermique']
WHERE question = 'What is the main source of energy for life on Earth?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le symbole chimique du potassium ?',
  options_fr = ARRAY['P', 'Po', 'K', 'Pt']
WHERE question = 'What is the chemical symbol for potassium?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel animal marin a trois cœurs et huit bras ?',
  options_fr = ARRAY['Méduse', 'Étoile de mer', 'Cheval marin', 'Pieuvre']
WHERE question = 'Which sea creature has three hearts and eight arms?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est l''unité de puissance ?',
  options_fr = ARRAY['Joule', 'Newton', 'Watt', 'Pascal']
WHERE question = 'What is the unit of power?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on le pigment vert des plantes ?',
  options_fr = ARRAY['Mélanine', 'Chlorophylle', 'Hémoglobine', 'Carotène']
WHERE question = 'What is the green pigment in plants called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on la transformation d''une chenille en papillon ?',
  options_fr = ARRAY['Photosynthèse', 'Hibernation', 'Métamorphose', 'Évolution']
WHERE question = 'What is the process of a caterpillar changing into a butterfly called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Lequel de ces gaz est un gaz noble ?',
  options_fr = ARRAY['Chlore', 'Sodium', 'Calcium', 'Néon']
WHERE question = 'Which of these is a noble gas?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le plus petit os du corps humain ?',
  options_fr = ARRAY['Fémur', 'Radius', 'Étrier', 'Patella']
WHERE question = 'What is the smallest bone in the human body?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on l''étude de la matière et de l''énergie ?',
  options_fr = ARRAY['Chimie', 'Biologie', 'Géologie', 'Physique']
WHERE question = 'What is the study of matter and energy called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel type d''animal est une grenouille ?',
  options_fr = ARRAY['Reptile', 'Mammifère', 'Amphibien', 'Oiseau']
WHERE question = 'What type of animal is a frog?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le principal matériau du « crayon » ?',
  options_fr = ARRAY['Plomb', 'Carbone', 'Charbon', 'Argile']
WHERE question = 'What is the main material in pencil "lead"?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien d''estomacs a une vache ?',
  options_fr = ARRAY['Un', 'Deux', 'Quatre', 'Trois']
WHERE question = 'How many stomachs does a cow have?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Comment appelle-t-on le pigment rouge du sang humain ?',
  options_fr = ARRAY['Chlorophylle', 'Mélanine', 'Insuline', 'Hémoglobine']
WHERE question = 'What is the red pigment in human blood called?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle est la troisième planète du Soleil ?',
  options_fr = ARRAY['Vénus', 'Mars', 'Terre', 'Mercure']
WHERE question = 'What is the third planet from the Sun?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le nom scientifique de la trachée ?',
  options_fr = ARRAY['Bronches', 'Œsophage', 'Trachée', 'Larynx']
WHERE question = 'What is the scientific name for the windpipe?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quelle planète est connue sous le nom de Planète Bleue ?',
  options_fr = ARRAY['Neptune', 'Terre', 'Uranus', 'Saturne']
WHERE question = 'Which planet is known as the Blue Planet?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Quel est le principal composant du gaz naturel ?',
  options_fr = ARRAY['Éthane', 'Propane', 'Butane', 'Méthane']
WHERE question = 'What is the main component of natural gas?' AND category = 'Science';

UPDATE public.questions SET
  question_fr = 'Combien de cavités a le cœur humain ?',
  options_fr = ARRAY['Deux', 'Trois', 'Quatre', 'Six']
WHERE question = 'How many chambers does the human human heart have?' AND category = 'Science';


-- ============================================================================
--  MATH (skip — math expressions are the same in French)
--  Math questions are universal (numbers/symbols), so we just copy them.
-- ============================================================================
UPDATE public.questions SET
  question_fr = question,
  options_fr = options
WHERE category = 'Math';


-- ============================================================================
--  FOOTBALL
-- ============================================================================
UPDATE public.questions SET
  question_fr = 'Dans quel pays le football moderne a-t-il pris son essor ?',
  options_fr = ARRAY['Brésil', 'Angleterre', 'Italie', 'Espagne']
WHERE question = 'In which country did modern football (soccer) originate?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Combien d''arbitres sont sur le terrain lors d''un match standard ?',
  options_fr = ARRAY['Un', 'Deux', 'Trois', 'Quatre']
WHERE question = 'How many match officials are on the pitch during a standard game?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'À quelle fréquence la Coupe du Monde FIFA a-t-elle lieu ?',
  options_fr = ARRAY['Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 5 ans']
WHERE question = 'How often is the FIFA World Cup held?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Que signifie un carton jaune ?',
  options_fr = ARRAY['Un avertissement', 'Un but', 'Un penalty', 'Expulsion']
WHERE question = 'What does a yellow card mean?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club joue ses matchs à domicile à Old Trafford ?',
  options_fr = ARRAY['Liverpool', 'Manchester United', 'Arsenal', 'Chelsea']
WHERE question = 'Which club plays its home games at Old Trafford?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Comment s''appelle le stade le plus célèbre du Brésil ?',
  options_fr = ARRAY['Maracanã', 'Estádio da Luz', 'Wembley', 'La Bombonera']
WHERE question = 'What is the name of Brazil''s most famous national stadium?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel poste porte généralement le numéro 1 ?',
  options_fr = ARRAY['Attaquant', 'Milieu de terrain', 'Défenseur', 'Gardien de but']
WHERE question = 'Which position usually wears the number 1 shirt?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle sélection nationale est surnommée « La Albiceleste » ?',
  options_fr = ARRAY['Mexique', 'Uruguay', 'Colombie', 'Argentine']
WHERE question = 'Which national team is nicknamed "La Albiceleste"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Comment s''appelle le premier championnat de football anglais ?',
  options_fr = ARRAY['La Liga', 'Premier League', 'Serie A', 'Bundesliga']
WHERE question = 'What is the name of the top division of English football?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club italien est surnommé « La Vieille Dame » ?',
  options_fr = ARRAY['AC Milan', 'Inter Milan', 'Juventus', 'Napoli']
WHERE question = 'Which Italian club is nicknamed "The Old Lady"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Qui est le meilleur buteur de l''histoire de la Coupe du Monde FIFA (hommes) ?',
  options_fr = ARRAY['Pelé', 'Ronaldo', 'Miroslav Klose', 'Gerd Müller']
WHERE question = 'Who is the all-time top scorer in FIFA World Cup history (men''s)?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Qu''est-ce qu''un match de « derby » ?',
  options_fr = ARRAY['Un match entre rivaux locaux', 'Une finale de coupe', 'Un match amical', 'Un match contre un club étranger']
WHERE question = 'What is a "derby" match?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle sélection nationale est surnommée « Les Trois Lions » ?',
  options_fr = ARRAY['Écosse', 'Pays de Galles', 'Angleterre', 'Irlande']
WHERE question = 'Which national team is nicknamed "The Three Lions"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'En cas de match de coupe nul après 90 minutes, que se passe-t-il ?',
  options_fr = ARRAY['But en or', 'Prolongations', 'Le match est rejoué', 'Un pile ou face']
WHERE question = 'In a knockout match tied after 90 minutes, what happens next?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle ville a accueilli la finale de la Coupe du Monde 2014 ?',
  options_fr = ARRAY['Rio de Janeiro', 'São Paulo', 'Brasilia', 'Belo Horizonte']
WHERE question = 'Which city hosted the 2014 World Cup final?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle est la largeur d''un but de football standard ?',
  options_fr = ARRAY['6,32 m', '7,32 m', '8,32 m', '9,32 m']
WHERE question = 'What is the width of a standard football goal?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle légende brésilienne est surnommée « Le Roi du Football » ?',
  options_fr = ARRAY['Ronaldinho', 'Ronaldo', 'Pelé', 'Neymar']
WHERE question = 'Which Brazilian legend is nicknamed "The King of Football"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Que signifie VAR ?',
  options_fr = ARRAY['Arbitre assistant vidéo', 'Revue d''arène virtuelle', 'Replay visuel assisté', 'Arbitre vérifié']
WHERE question = 'What does VAR stand for?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club est surnommé « Les Canonniers » ?',
  options_fr = ARRAY['Tottenham', 'Arsenal', 'Chelsea', 'West Ham']
WHERE question = 'Which club is nicknamed "The Gunners"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Combien de temps dure la mi-temps d''un match standard ?',
  options_fr = ARRAY['5 minutes', '10 minutes', '15 minutes', '20 minutes']
WHERE question = 'How long is the halftime break in a standard match?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle sélection sud-américaine est surnommée « La Celeste » ?',
  options_fr = ARRAY['Pérou', 'Argentine', 'Chili', 'Uruguay']
WHERE question = 'Which South American national team is nicknamed "La Celeste"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club a remporté le plus de Coupes d''Europe / Ligues des Champions ?',
  options_fr = ARRAY['Barcelone', 'AC Milan', 'Bayern Munich', 'Real Madrid']
WHERE question = 'Which club has won the most European Cups / Champions League titles?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle légende argentine a remporté la Coupe du Monde 1986 presque à elle seule ?',
  options_fr = ARRAY['Lionel Messi', 'Diego Maradona', 'Gabriel Batistuta', 'Carlos Tevez']
WHERE question = 'Which Argentine legend won the 1986 World Cup almost single-handedly?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Comment la sélection allemande est-elle communément appelée ?',
  options_fr = ARRAY['Die Mannschaft', 'Los Blancos', 'Les Diables Rouges', 'La Furia Roja']
WHERE question = 'What is the German national team commonly called?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club anglais joue à Anfield ?',
  options_fr = ARRAY['Everton', 'Liverpool', 'Manchester City', 'Newcastle']
WHERE question = 'Which English club plays at Anfield?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quelle est la distance du point de penalty au but ?',
  options_fr = ARRAY['9 mètres', '10 mètres', '11 mètres', '12 mètres']
WHERE question = 'What is the distance from the penalty spot to the goal?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel joueur est surnommé « CR7 » ?',
  options_fr = ARRAY['Cristiano Ronaldo', 'Ronaldinho', 'Roberto Carlos', 'Ronaldo Nazário']
WHERE question = 'Which player is nicknamed "CR7"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Que signifie un carton rouge ?',
  options_fr = ARRAY['Un avertissement', 'Le joueur est expulsé', 'Un coup franc pour l''adversaire', 'Le but est annulé']
WHERE question = 'What does a red card mean?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Quel club est connu sous le nom de « Los Blancos » ?',
  options_fr = ARRAY['Atlético Madrid', 'Séville', 'Barcelone', 'Real Madrid']
WHERE question = 'Which club is known as "Los Blancos"?' AND category = 'Football';

UPDATE public.questions SET
  question_fr = 'Qu''est-ce qu''un « clean sheet » ?',
  options_fr = ARRAY['Un match sans encaisser de but', 'Un terrain neuf', 'Une victoire par 3 buts', 'Un but annulé']
WHERE question = 'What is a "clean sheet"?' AND category = 'Football';


-- ============================================================================
--  HISTORY
-- ============================================================================
UPDATE public.questions SET
  question_fr = 'En quelle année Christophe Colomb a-t-il découvert l''Amérique ?',
  options_fr = ARRAY['1492', '1776', '1066', '1215']
WHERE question = 'In what year did Christopher Columbus discover America?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a peint la Joconde ?',
  options_fr = ARRAY['Michel-Ange', 'Léonard de Vinci', 'Raphaël', 'Rembrandt']
WHERE question = 'Who painted the Mona Lisa?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve la Tour Eiffel ?',
  options_fr = ARRAY['Londres', 'Rome', 'Paris', 'Berlin']
WHERE question = 'In which city is the Eiffel Tower located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année a commencé la Première Guerre mondiale ?',
  options_fr = ARRAY['1905', '1912', '1914', '1918']
WHERE question = 'In what year did World War I begin?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui était le premier président des États-Unis ?',
  options_fr = ARRAY['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin']
WHERE question = 'Who was the first President of the United States?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel empire a construit la Grande Muraille de Chine ?',
  options_fr = ARRAY['Empire mongol', 'Empire romain', 'Empire chinois', 'Empire perse']
WHERE question = 'Which empire built the Great Wall of China?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année le mur de Berlin est-il tombé ?',
  options_fr = ARRAY['1987', '1989', '1991', '1985']
WHERE question = 'In what year did the Berlin Wall fall?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a écrit « Romeo et Juliette » ?',
  options_fr = ARRAY['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain']
WHERE question = 'Who wrote "Romeo and Juliet"?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle civilisation les pyramides ont-elles été construites pour la première fois ?',
  options_fr = ARRAY['Mésopotamie', 'Grèce', 'Égypte', 'Rome']
WHERE question = 'In which civilization were pyramids first built?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a volé la Joconde en 1911 ?',
  options_fr = ARRAY['Vincenzo Peruggia', 'Pablo Picasso', 'Napoléon Bonaparte', 'Vincent van Gogh']
WHERE question = 'Who stole the Mona Lisa in 1911?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la Déclaration d''indépendance américaine a-t-elle été signée ?',
  options_fr = ARRAY['1774', '1776', '1789', '1791']
WHERE question = 'In what year was the American Declaration of Independence signed?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel dirigeant est associé à la Révolution française ?',
  options_fr = ARRAY['Napoléon', 'Louis XVI', 'Robespierre', 'Richelieu']
WHERE question = 'Which leader is associated with the French Revolution?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve le Colisée ?',
  options_fr = ARRAY['Athènes', 'Rome', 'Istanbul', 'Le Caire']
WHERE question = 'In which city is the Colosseum located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a été le premier homme à marcher sur la Lune ?',
  options_fr = ARRAY['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'John Glenn']
WHERE question = 'Who was the first man to walk on the Moon?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la Révolution française a-t-elle commencé ?',
  options_fr = ARRAY['1776', '1789', '1804', '1815']
WHERE question = 'In what year did the French Revolution begin?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel pays a développé en premier les armes nucléaires ?',
  options_fr = ARRAY['URSS', 'Royaume-Uni', 'États-Unis', 'France']
WHERE question = 'Which country first developed nuclear weapons?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a écrit « Les Misérables » ?',
  options_fr = ARRAY['Gustave Flaubert', 'Victor Hugo', 'Émile Zola', 'Honoré de Balzac']
WHERE question = 'Who wrote "Les Misérables"?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle civilisation l''alphabet a-t-il été inventé ?',
  options_fr = ARRAY['Chine', 'Phénicie', 'Égypte', 'Grèce']
WHERE question = 'In which civilization was the alphabet invented?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année l''Empire romain est-il tombé ?',
  options_fr = ARRAY['376', '476', '576', '276']
WHERE question = 'In what year did the Roman Empire fall?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui était le premier empereur romain ?',
  options_fr = ARRAY['Jules César', 'Auguste', 'Néron', 'Caligula']
WHERE question = 'Who was the first Roman Emperor?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve le Taj Mahal ?',
  options_fr = ARRAY['Delhi', 'Jaipur', 'Agra', 'Bombay']
WHERE question = 'In which city is the Taj Mahal located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année Magellan a-t-il commencé son voyage autour du monde ?',
  options_fr = ARRAY['1492', '1519', '1533', '1588']
WHERE question = 'In what year did Magellan begin his circumnavigation?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel événement a eu lieu en 1066 en Angleterre ?',
  options_fr = ARRAY['La Grande Charte', 'La Bataille de Hastings', 'La Peste noire', 'La découverte de l''Amérique']
WHERE question = 'What event happened in 1066 in England?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a peint le plafond de la Chapelle Sixtine ?',
  options_fr = ARRAY['Léonard de Vinci', 'Raphaël', 'Michel-Ange', 'Donatello']
WHERE question = 'Who painted the Sistine Chapel ceiling?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quel pays la Révolution industrielle a-t-elle commencé ?',
  options_fr = ARRAY['France', 'Allemagne', 'États-Unis', 'Angleterre']
WHERE question = 'In which country did the Industrial Revolution begin?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la Seconde Guerre mondiale a-t-elle pris fin ?',
  options_fr = ARRAY['1943', '1944', '1945', '1946']
WHERE question = 'In what year did World War II end?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui était le roi d''Égypte le plus célèbre ?',
  options_fr = ARRAY['Ramsetès', 'Toutankhamon', 'Cléopâtre', 'Khéops']
WHERE question = 'Who was the most famous king of Egypt?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel pays a remporté la première Coupe du Monde de football en 1930 ?',
  options_fr = ARRAY['Brésil', 'Argentine', 'Uruguay', 'Italie']
WHERE question = 'Which country won the first FIFA World Cup in 1930?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année a eu lieu la première course de chevaux aux Jeux Olympiques antiques ?',
  options_fr = ARRAY['680 av. J.-C.', '776 av. J.-C.', '500 av. J.-C.', '300 av. J.-C.']
WHERE question = 'In what year were horse races first held at the ancient Olympic Games?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel pays a été le premier à accorder le suffrage aux femmes ?',
  options_fr = ARRAY['États-Unis', 'Royaume-Uni', 'Nouvelle-Zélande', 'France']
WHERE question = 'Which country was the first to grant women the right to vote?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a écrit « Le Prince » ?',
  options_fr = ARRAY['Galilée', 'Machiavel', 'Léonard de Vinci', 'Michel-Ange']
WHERE question = 'Who wrote "The Prince"?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve la Statue de la Liberté ?',
  options_fr = ARRAY['Boston', 'Philadelphie', 'New York', 'Washington']
WHERE question = 'In which city is the Statue of Liberty located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année Napoléon a-t-il été définitivement exilé ?',
  options_fr = ARRAY['1804', '1812', '1815', '1821']
WHERE question = 'In what year was Napoleon permanently exiled?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel événement a eu lieu en 1789 à Paris ?',
  options_fr = ARRAY['La prise de la Bastille', 'La bataille de Waterloo', 'La mort de Louis XIV', 'La proclamation de l''Empire']
WHERE question = 'What event happened in 1789 in Paris?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a été le dernier roi de France avant la Révolution ?',
  options_fr = ARRAY['Louis XIV', 'Louis XV', 'Louis XVI', 'Louis XVIII']
WHERE question = 'Who was the last king of France before the Revolution?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quel pays se trouvent les ruines de Machu Picchu ?',
  options_fr = ARRAY['Colombie', 'Équateur', 'Pérou', 'Bolivie']
WHERE question = 'In which country are the ruins of Machu Picchu located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la Déclaration des droits de l''homme a-t-elle été adoptée en France ?',
  options_fr = ARRAY['1776', '1789', '1799', '1804']
WHERE question = 'In what year was the Declaration of the Rights of Man adopted in France?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a découvert la pénicilline ?',
  options_fr = ARRAY['Louis Pasteur', 'Alexander Fleming', 'Robert Koch', 'Joseph Lister']
WHERE question = 'Who discovered penicillin?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année a eu lieu le D-Day en Normandie ?',
  options_fr = ARRAY['1943', '1944', '1945', '1942']
WHERE question = 'In what year did D-Day take place in Normandy?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel est le plus vieux sport en compétition aux Jeux Olympiques ?',
  options_fr = ARRAY['Cyclisme', 'Natation', 'Marathon', 'Lutte']
WHERE question = 'What is the oldest competitive sport at the Olympic Games?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve la Sagrada Família ?',
  options_fr = ARRAY['Madrid', 'Barcelone', 'Séville', 'Valence']
WHERE question = 'In which city is the Sagrada Família located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la peste noire a-t-elle frappé l''Europe ?',
  options_fr = ARRAY['1066', '1215', '1347', '1492']
WHERE question = 'In what year did the Black Death strike Europe?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui était le premier empereur de Chine ?',
  options_fr = ARRAY['Confucius', 'Qin Shi Huang', 'Gengis Khan', 'Kublaï Khan']
WHERE question = 'Who was the first Emperor of China?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel pays a organisé les premiers Jeux Olympiques modernes ?',
  options_fr = ARRAY['France', 'États-Unis', 'Royaume-Uni', 'Grèce']
WHERE question = 'Which country hosted the first modern Olympic Games?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve la Cradle of Humankind ?',
  options_fr = ARRAY['Nairobi', 'Le Cap', 'Johannesburg', 'Pretoria']
WHERE question = 'In which city is the Cradle of Humankind located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année a eu lieu le premier vol motorisé des frères Wright ?',
  options_fr = ARRAY['1900', '1903', '1906', '1910']
WHERE question = 'In what year did the Wright brothers make their first powered flight?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a écrit « De la démocratie en Amérique » ?',
  options_fr = ARRAY['Benjamin Franklin', 'Thomas Jefferson', 'Alexis de Tocqueville', 'John Adams']
WHERE question = 'Who wrote "Democracy in America"?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Quel événement sportif se tient tous les deux ans depuis 1930 ?',
  options_fr = ARRAY['Les Jeux Olympiques d''hiver', 'La Coupe du Monde de rugby', 'Le Tour de France', 'La Copa América']
WHERE question = 'What sporting event has been held every two years since 1930?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quelle ville se trouve le Parlement de la Barbouille ?',
  options_fr = ARRAY['Londres', 'Édimbourg', 'Cardiff', 'Dublin']
WHERE question = 'In which city is the Palace of Westminster located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année la Grande Dépression a-t-elle commencé ?',
  options_fr = ARRAY['1920', '1929', '1939', '1941']
WHERE question = 'In what year did the Great Depression begin?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Qui a écrit « Le Contrat social » ?',
  options_fr = ARRAY['Voltaire', 'Rousseau', 'Montesquieu', 'Diderot']
WHERE question = 'Who wrote "The Social Contract"?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année le phénomène El Niño a-t-il été identifié pour la première fois ?',
  options_fr = ARRAY['1950', '1960', '1972', '1985']
WHERE question = 'In what year was El Niño first identified?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'Dans quel pays se trouve Angkor Wat ?',
  options_fr = ARRAY['Thaïlande', 'Viêt Nam', 'Cambodge', 'Laos']
WHERE question = 'In which country is Angkor Wat located?' AND category = 'History';

UPDATE public.questions SET
  question_fr = 'En quelle année a eu lieu le premier vol motorisé des frères Wright ?',
  options_fr = ARRAY['1900', '1903', '1906', '1910']
WHERE question = 'In what year did the Wright brothers make their first powered flight?' AND category = 'History';

-- Update remaining History questions that don't have explicit translations yet
-- (they fall back to English if question_fr is NULL)
UPDATE public.questions SET
  question_fr = question,
  options_fr = options
WHERE category = 'History' AND question_fr IS NULL;
