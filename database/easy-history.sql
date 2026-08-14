-- ============================================================================
--  easy-history.sql — replace the live DB's History questions with easy ones
--
--  WHAT THIS DOES:
--    The old History bank was full of niche, hard questions (last Hawaiian
--  queen, "rabona", Inca emperors…). This script wipes EVERY History question
--  from an existing project and inserts 120 easy, widely-known history
--  questions instead: the 10 classic seed ones + the 110 from the rewritten
--  History block in questions-bank.sql.
--
--  HOW TO USE:
--    supabase.com -> your project -> SQL Editor -> paste this whole file -> RUN
--    (runs as the service role, so RLS doesn't block it)
--
--  SAFE TO RE-RUN: it deletes first, so running it twice just re-inserts the
--  same 120 questions. Other categories (Science / Math / Football) are
--  untouched.
--
--  NOTE ON OLD MATCHES: finished matches keep their old question ids in
--  question_ids; the app skips questions that no longer exist when reviewing
--  an old match, so nothing breaks. answer_log has no FK to questions, so the
--  Stats screen keeps working too.
-- ============================================================================

-- 1) clear answer rows pointing at History questions first, so the questions
--    themselves can be deleted (match_answers.question_id has an FK to
--    public.questions). Guarded in case the table doesn't exist yet.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'match_answers'
  ) then
    delete from public.match_answers
    where question_id in (select id from public.questions where category = 'History');
  end if;
end;
$$;

-- 2) remove the old (hard) History questions
delete from public.questions where category = 'History';

-- 3) insert the easy History set: 10 classic + 110 rewritten = 120
insert into public.questions (category, question, options, correct_index) values

-- ============ classic seed set (10) ============
('History', 'In what year did World War II end?',
  ARRAY['1943', '1944', '1945', '1946'], 2),

('History', 'Who was the first President of the United States?',
  ARRAY['John Adams', 'Thomas Jefferson', 'George Washington', 'Benjamin Franklin'], 2),

('History', 'What ancient civilization built the pyramids of Giza?',
  ARRAY['Roman', 'Greek', 'Egyptian', 'Mayan'], 2),

('History', 'What year did the Titanic sink?',
  ARRAY['1910', '1912', '1914', '1916'], 1),

('History', 'Which empire was ruled by Genghis Khan?',
  ARRAY['Ottoman', 'Roman', 'Mongol', 'Persian'], 2),

('History', 'In which year did the Berlin Wall fall?',
  ARRAY['1985', '1989', '1991', '1993'], 1),

('History', 'Who was the ancient Greek god of the sea?',
  ARRAY['Zeus', 'Apollo', 'Poseidon', 'Ares'], 2),

('History', 'What ship did Charles Darwin sail on?',
  ARRAY['Beagle', 'Endeavour', 'Victory', 'Mayflower'], 0),

('History', 'Who was the first person to walk on the Moon?',
  ARRAY['Buzz Aldrin', 'Neil Armstrong', 'Michael Collins', 'Yuri Gagarin'], 1),

('History', 'Who painted the Mona Lisa?',
  ARRAY['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], 2),

-- ============ rewritten bank set (110) ============
('History', 'In which year did World War I begin?', ARRAY['1912', '1913', '1914', '1915'], 2),
('History', 'Who was the leader of Nazi Germany during World War II?', ARRAY['Joseph Stalin', 'Adolf Hitler', 'Benito Mussolini', 'Winston Churchill'], 1),
('History', 'In which year did World War II begin?', ARRAY['1937', '1938', '1939', '1940'], 2),
('History', 'Which city was buried by ash when Mount Vesuvius erupted in 79 AD?', ARRAY['Pompeii', 'Rome', 'Athens', 'Carthage'], 0),
('History', 'Who wrote the famous play "Romeo and Juliet"?', ARRAY['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'], 1),
('History', 'In which city were the first modern Olympic Games held in 1896?', ARRAY['Paris', 'London', 'Athens', 'Rome'], 2),
('History', 'Which country gifted the Statue of Liberty to the United States?', ARRAY['England', 'Spain', 'France', 'Italy'], 2),
('History', 'What was the name of the ship that carried the Pilgrims to America in 1620?', ARRAY['Mayflower', 'Santa Maria', 'Endeavour', 'Beagle'], 0),
('History', 'Who was the leader of the Soviet Union during most of World War II?', ARRAY['Vladimir Lenin', 'Joseph Stalin', 'Nikita Khrushchev', 'Leon Trotsky'], 1),
('History', 'In which year did the United States declare its independence?', ARRAY['1774', '1775', '1776', '1778'], 2),
('History', 'Who discovered penicillin in 1928?', ARRAY['Louis Pasteur', 'Alexander Fleming', 'Marie Curie', 'Edward Jenner'], 1),
('History', 'Which war was fought between the North and the South in the United States?', ARRAY['Revolutionary War', 'Civil War', 'War of 1812', 'Spanish-American War'], 1),
('History', 'Who gave the famous "I Have a Dream" speech?', ARRAY['Rosa Parks', 'Malcolm X', 'Martin Luther King Jr.', 'Jesse Jackson'], 2),
('History', 'Who was the first African-American President of the United States?', ARRAY['Martin Luther King Jr.', 'Colin Powell', 'Barack Obama', 'Frederick Douglass'], 2),
('History', 'Who became South Africa''s first Black president in 1994?', ARRAY['Desmond Tutu', 'Thabo Mbeki', 'Nelson Mandela', 'F. W. de Klerk'], 2),
('History', 'What was the name of the first artificial satellite, launched in 1957?', ARRAY['Explorer 1', 'Sputnik 1', 'Vostok 1', 'Telstar'], 1),
('History', 'In which year did humans first land on the Moon?', ARRAY['1965', '1967', '1969', '1971'], 2),
('History', 'Who invented the telephone?', ARRAY['Thomas Edison', 'Alexander Graham Bell', 'Nikola Tesla', 'Guglielmo Marconi'], 1),
('History', 'Which ancient civilization built Machu Picchu in Peru?', ARRAY['Aztec', 'Maya', 'Inca', 'Olmec'], 2),
('History', 'What was the name of the wall that separated East and West Berlin?', ARRAY['The Iron Curtain', 'The Berlin Wall', 'The Great Wall', 'Hadrian''s Wall'], 1),
('History', 'Which queen ruled England during the time of William Shakespeare?', ARRAY['Queen Victoria', 'Elizabeth I', 'Mary I', 'Queen Anne'], 1),
('History', 'In which year did the French Revolution begin?', ARRAY['1776', '1789', '1799', '1815'], 1),
('History', 'What was the deadly worldwide flu pandemic of 1918 called?', ARRAY['Spanish Flu', 'Asian Flu', 'Swine Flu', 'Cholera'], 0),
('History', 'Which famous military leader became Emperor of France in 1804?', ARRAY['Napoleon Bonaparte', 'Julius Caesar', 'Alexander the Great', 'Charlemagne'], 0),
('History', 'In which year was the Battle of Waterloo fought?', ARRAY['1805', '1812', '1815', '1818'], 2),
('History', 'Who was the Greek philosopher who taught Alexander the Great?', ARRAY['Socrates', 'Plato', 'Aristotle', 'Pythagoras'], 2),
('History', 'What was the famous trade route that connected China with Europe called?', ARRAY['Spice Route', 'Silk Road', 'Royal Road', 'Amber Road'], 1),
('History', 'Who was the Egyptian queen famous for her relationship with Julius Caesar and Mark Antony?', ARRAY['Nefertiti', 'Cleopatra', 'Hatshepsut', 'Isis'], 1),
('History', 'Which empire built the Colosseum in Rome?', ARRAY['Greek', 'Roman', 'Egyptian', 'Persian'], 1),
('History', 'Who was the first woman to fly solo across the Atlantic Ocean?', ARRAY['Harriet Quimby', 'Bessie Coleman', 'Amelia Earhart', 'Jacqueline Cochran'], 2),
('History', 'Who was the first woman to win a Nobel Prize?', ARRAY['Marie Curie', 'Rosalind Franklin', 'Jane Goodall', 'Florence Nightingale'], 0),
('History', 'Who invented the practical electric light bulb?', ARRAY['Nikola Tesla', 'Thomas Edison', 'Benjamin Franklin', 'James Watt'], 1),
('History', 'Which English king was forced to sign the Magna Carta in 1215?', ARRAY['King John', 'Henry VIII', 'Richard the Lionheart', 'William the Conqueror'], 0),
('History', 'In which year did World War I end?', ARRAY['1916', '1917', '1918', '1919'], 2),
('History', 'Which US President issued the Emancipation Proclamation?', ARRAY['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'Andrew Johnson'], 2),
('History', 'In which year was Abraham Lincoln assassinated?', ARRAY['1861', '1863', '1865', '1867'], 2),
('History', 'What was the name of the German air force during World War II?', ARRAY['Wehrmacht', 'Luftwaffe', 'Kriegsmarine', 'Gestapo'], 1),
('History', 'Which US state was the site of the first airplane flight in 1903?', ARRAY['North Carolina', 'Ohio', 'California', 'Texas'], 0),
('History', 'Who was the first human to travel into space?', ARRAY['Neil Armstrong', 'Yuri Gagarin', 'Buzz Aldrin', 'John Glenn'], 1),
('History', 'What was the name of the US space program that landed men on the Moon?', ARRAY['Mercury', 'Gemini', 'Apollo', 'Voyager'], 2),
('History', 'In which year did the Soviet Union dissolve?', ARRAY['1989', '1990', '1991', '1993'], 2),
('History', 'Which ancient Greek city-state is known as the birthplace of democracy?', ARRAY['Sparta', 'Athens', 'Corinth', 'Thebes'], 1),
('History', 'Who was the Roman general who became dictator and was assassinated in 44 BC?', ARRAY['Augustus', 'Julius Caesar', 'Nero', 'Pompey'], 1),
('History', 'What was the ancient Egyptian writing system of pictures and symbols called?', ARRAY['Cuneiform', 'Hieroglyphics', 'Runes', 'Linear B'], 1),
('History', 'Which Italian artist painted the ceiling of the Sistine Chapel?', ARRAY['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'], 1),
('History', 'Who developed the theory of evolution by natural selection?', ARRAY['Charles Darwin', 'Isaac Newton', 'Albert Einstein', 'Gregor Mendel'], 0),
('History', 'In which year did the United States enter World War II?', ARRAY['1939', '1940', '1941', '1942'], 2),
('History', 'What event sparked the start of World War I in 1914?', ARRAY['The assassination of Archduke Franz Ferdinand', 'The bombing of Pearl Harbor', 'The sinking of the Titanic', 'The Russian Revolution'], 0),
('History', 'Which country did the Vikings originally come from?', ARRAY['England', 'Norway', 'Ireland', 'France'], 1),
('History', 'Who refused to give up her bus seat in Montgomery, Alabama, in 1955?', ARRAY['Rosa Parks', 'Harriet Tubman', 'Sojourner Truth', 'Ruby Bridges'], 0),
('History', 'In which city did American colonists dump tea into the harbor in 1773?', ARRAY['New York', 'Philadelphia', 'Boston', 'Charleston'], 2),
('History', 'Which country built the Great Wall?', ARRAY['Japan', 'India', 'China', 'Mongolia'], 2),
('History', 'What was the deadly disease that swept through Europe during the Middle Ages?', ARRAY['Smallpox', 'The Black Death', 'Cholera', 'Typhoid'], 1),
('History', 'In which year did Christopher Columbus first reach the Americas?', ARRAY['1482', '1492', '1502', '1512'], 1),
('History', 'Which country was the center of the Renaissance?', ARRAY['France', 'England', 'Italy', 'Germany'], 2),
('History', 'Who wrote the epic poems "The Iliad" and "The Odyssey"?', ARRAY['Plato', 'Homer', 'Virgil', 'Socrates'], 1),
('History', 'What was the name of the first permanent English settlement in America?', ARRAY['Jamestown', 'Plymouth', 'Roanoke', 'Boston'], 0),
('History', 'Who was known as the "Iron Lady"?', ARRAY['Queen Elizabeth II', 'Angela Merkel', 'Margaret Thatcher', 'Theresa May'], 2),
('History', 'Which queen ruled Britain for over 60 years in the 19th century?', ARRAY['Queen Victoria', 'Queen Elizabeth I', 'Queen Anne', 'Queen Mary'], 0),
('History', 'In which year was the United Nations founded?', ARRAY['1943', '1944', '1945', '1946'], 2),
('History', 'The Cold War was a rivalry between which two superpowers?', ARRAY['USA and China', 'USA and the Soviet Union', 'Britain and Germany', 'France and Russia'], 1),
('History', 'Which country dropped atomic bombs on Japan in 1945?', ARRAY['Germany', 'Soviet Union', 'United States', 'Britain'], 2),
('History', 'Who led the Russian Revolution of 1917?', ARRAY['Joseph Stalin', 'Vladimir Lenin', 'Leon Trotsky', 'Karl Marx'], 1),
('History', 'What was the name of the wall the Romans built across northern Britain?', ARRAY['Hadrian''s Wall', 'The Great Wall', 'Offa''s Dyke', 'The Berlin Wall'], 0),
('History', 'Which famous leader fought for India''s independence from Britain?', ARRAY['Jawaharlal Nehru', 'Mahatma Gandhi', 'Muhammad Ali Jinnah', 'Indira Gandhi'], 1),
('History', 'Who was the ancient Greek goddess of wisdom?', ARRAY['Hera', 'Athena', 'Aphrodite', 'Artemis'], 1),
('History', 'Which English king had six wives?', ARRAY['Henry VII', 'Henry VIII', 'Edward VI', 'James I'], 1),
('History', 'Who was the leader of Cuba during the Cold War?', ARRAY['Che Guevara', 'Fidel Castro', 'Raul Castro', 'Salvador Allende'], 1),
('History', 'Which Asian country was split into North and South after World War II?', ARRAY['Vietnam', 'China', 'Korea', 'Japan'], 2),
('History', 'In which year did the Great Depression begin?', ARRAY['1925', '1927', '1929', '1931'], 2),
('History', 'Which ancient civilization in Central America was famous for its calendar and pyramids?', ARRAY['Maya', 'Inca', 'Olmec', 'Aztec'], 0),
('History', 'Which British nurse became famous during the Crimean War?', ARRAY['Florence Nightingale', 'Mary Seacole', 'Clara Barton', 'Edith Cavell'], 0),
('History', 'Who was the last Tsar of Russia?', ARRAY['Peter the Great', 'Alexander II', 'Nicholas II', 'Ivan the Terrible'], 2),
('History', 'In which year did the Great Fire of London take place?', ARRAY['1642', '1666', '1688', '1701'], 1),
('History', 'Which US President was assassinated in Dallas, Texas, in 1963?', ARRAY['John F. Kennedy', 'Richard Nixon', 'Lyndon B. Johnson', 'Franklin D. Roosevelt'], 0),
('History', 'Who invented the European printing press with movable type around 1440?', ARRAY['Johannes Gutenberg', 'William Caxton', 'Leonardo da Vinci', 'Galileo Galilei'], 0),
('History', 'In which US city was the Declaration of Independence signed in 1776?', ARRAY['Boston', 'New York', 'Philadelphia', 'Washington D.C.'], 2),
('History', 'Which US state was the site of the 1849 Gold Rush?', ARRAY['Texas', 'California', 'Alaska', 'Nevada'], 1),
('History', 'Which empire was ruled by Emperor Hirohito during World War II?', ARRAY['Germany', 'Italy', 'Japan', 'Ottoman Empire'], 2),
('History', 'Who was the Egyptian boy king whose tomb was discovered in 1922?', ARRAY['Ramses II', 'Tutankhamun', 'Akhenaten', 'Seti I'], 1),
('History', 'Who was the first Emperor of Rome?', ARRAY['Julius Caesar', 'Augustus', 'Nero', 'Constantine'], 1),
('History', 'What was the central public square of ancient Rome, used for meetings and markets, called?', ARRAY['The Forum', 'The Agora', 'The Circus', 'The Campus'], 0),
('History', 'Which European country colonized Australia in the 18th century?', ARRAY['France', 'Britain', 'Spain', 'Portugal'], 1),
('History', 'Which Greek philosopher was sentenced to death by drinking hemlock?', ARRAY['Plato', 'Aristotle', 'Socrates', 'Epicurus'], 2),
('History', 'What was the war between England and France that lasted over 100 years called?', ARRAY['The Hundred Years'' War', 'The Thirty Years'' War', 'The War of the Roses', 'The Napoleonic Wars'], 0),
('History', 'Which empire ruled central Mexico when the Spanish arrived in the 1500s?', ARRAY['Peru', 'Mexico', 'Brazil', 'Chile'], 1),
('History', 'In which continent was the Inca Empire located?', ARRAY['Africa', 'South America', 'Asia', 'Europe'], 1),
('History', 'Who led the first expedition to sail around the world?', ARRAY['Ferdinand Magellan', 'Christopher Columbus', 'Vasco da Gama', 'James Cook'], 0),
('History', 'Which country surrendered to end World War II in Europe in May 1945?', ARRAY['Japan', 'Italy', 'Germany', 'Austria'], 2),
('History', 'What was the name of the famous World War II invasion of Normandy in 1944?', ARRAY['Operation Barbarossa', 'D-Day', 'The Blitz', 'The Battle of Britain'], 1),
('History', 'What were the two main alliances in World War I called?', ARRAY['The Allies and the Central Powers', 'NATO and the Warsaw Pact', 'The Axis and the Allies', 'East and West'], 0),
('History', 'Which ancient civilization is credited with inventing paper?', ARRAY['Rome', 'China', 'Egypt', 'Greece'], 1),
('History', 'In which year did the Space Shuttle Challenger disaster occur?', ARRAY['1984', '1985', '1986', '1987'], 2),
('History', 'In which year did the American Civil War begin?', ARRAY['1859', '1860', '1861', '1863'], 2),
('History', 'Which French queen was executed by guillotine during the French Revolution?', ARRAY['Marie Antoinette', 'Catherine de Medici', 'Anne of Austria', 'Josephine'], 0),
('History', 'Who was the Supreme Commander of the Allied forces in Europe during World War II?', ARRAY['Dwight D. Eisenhower', 'George Patton', 'Winston Churchill', 'Douglas MacArthur'], 0),
('History', 'In which Greek town were the ancient Olympic Games held?', ARRAY['Olympia', 'Delphi', 'Sparta', 'Marathon'], 0),
('History', 'Who was the ancient Greek mathematician famous for the Pythagorean theorem?', ARRAY['Euclid', 'Pythagoras', 'Archimedes', 'Plato'], 1),
('History', 'Which country ruled India before it gained independence in 1947?', ARRAY['France', 'Portugal', 'Britain', 'Netherlands'], 2),
('History', 'In which year did India gain independence from Britain?', ARRAY['1937', '1945', '1947', '1950'], 2),
('History', 'Who was the leader of the Soviet Union during the Cuban Missile Crisis?', ARRAY['Nikita Khrushchev', 'Joseph Stalin', 'Leonid Brezhnev', 'Mikhail Gorbachev'], 0),
('History', 'Who was the British Prime Minister for most of World War II?', ARRAY['Neville Chamberlain', 'Winston Churchill', 'Clement Attlee', 'Anthony Eden'], 1),
('History', 'Who wrote a famous diary while hiding from the Nazis in Amsterdam?', ARRAY['Anne Frank', 'Sophie Scholl', 'Malala Yousafzai', 'Hannah Senesh'], 0),
('History', 'Which explorer found the sea route from Europe to India?', ARRAY['Vasco da Gama', 'Ferdinand Magellan', 'James Cook', 'Marco Polo'], 0),
('History', 'Who was the US President during most of World War II?', ARRAY['Franklin D. Roosevelt', 'Harry S. Truman', 'Woodrow Wilson', 'Dwight D. Eisenhower'], 0),
('History', 'Which French king was known as the "Sun King"?', ARRAY['Louis XIV', 'Louis XVI', 'Napoleon III', 'Henry IV'], 0),
('History', 'What is the flag of the United Kingdom commonly called?', ARRAY['The Union Jack', 'The Stars and Stripes', 'The Tricolor', 'The Maple Leaf'], 0),
('History', 'Who was the ancient Greek god of the sun?', ARRAY['Apollo', 'Ares', 'Hermes', 'Dionysus'], 0),
('History', 'Which city was the capital of the Roman Empire?', ARRAY['Rome', 'Athens', 'Constantinople', 'Carthage'], 0),
('History', 'What was the 1929 stock market crash called?', ARRAY['The Wall Street Crash', 'The Housing Crash', 'The Dot-com Crash', 'The Oil Crisis'], 0);

-- ============================================================================
--  DONE!  History now holds 120 easy, well-known questions.
--  Re-running this file is safe (it deletes + re-inserts the same set).
-- ============================================================================
