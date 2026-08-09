-- ============================================================================
--  seed.sql — Trivia1v1 seed data
--  Creates a bot user and 40 starter questions across exactly 4 categories:
--  Science, Math, Football, History (10 each).
--
--  ⚠️  Run database/questions-bank.sql afterwards for the full bank of
--  480 questions (440 more). Then refresh the matchmaking RPCs so every match
--  mixes all 4 categories: on a FRESH project re-run schema.sql, on an
--  EXISTING project re-run setup-demo.sql, and re-run friends-bots.sql either
--  way (it redefines create_challenge / finish_match).
-- ============================================================================

-- Create the bot user
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_current, email_change
) values (
  '00000000-0000-0000-0000-000000000001',
  'bot@triviaduel.local',
  '$2a$10$xJwKqQjQjQjQjQjQjQjQjOe8e8e8e8e8e8e8e8e8e8e8e8e8e8e',
  now(), now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;

-- Give the bot a profile (excluded from leaderboard via BOT_ID)
insert into public.profiles (id, username)
values ('00000000-0000-0000-0000-000000000001', 'QuizBot')
on conflict (id) do nothing;


-- ============================================================================
--  QUESTIONS — Science, Math, Football, History (10 each)
-- ============================================================================
insert into public.questions (category, question, options, correct_index) values

-- ============ Science ============
('Science', 'What planet is known as the Red Planet?',
  ARRAY['Venus', 'Mars', 'Jupiter', 'Saturn'], 1),

('Science', 'What gas do plants absorb from the atmosphere?',
  ARRAY['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], 2),

('Science', 'What is the chemical symbol for water?',
  ARRAY['HO', 'H2O', 'OH2', 'H3O'], 1),

('Science', 'How many bones are in the adult human body?',
  ARRAY['186', '206', '216', '256'], 1),

('Science', 'What force keeps us on the ground?',
  ARRAY['Magnetism', 'Friction', 'Gravity', 'Inertia'], 2),

('Science', 'What is the powerhouse of the cell?',
  ARRAY['Nucleus', 'Ribosome', 'Mitochondria', 'Cell wall'], 2),

('Science', 'What is the speed of light in a vacuum, roughly?',
  ARRAY['300,000 km/s', '150,000 km/s', '1,000,000 km/s', '30,000 km/s'], 0),

('Science', 'Which planet is the largest in our solar system?',
  ARRAY['Earth', 'Saturn', 'Neptune', 'Jupiter'], 3),

('Science', 'What element has the atomic number 6?',
  ARRAY['Oxygen', 'Carbon', 'Nitrogen', 'Helium'], 1),

('Science', 'What is H2O commonly known as?',
  ARRAY['Salt', 'Peroxide', 'Water', 'Ammonia'], 2),

-- ============ Math ============
('Math', 'What is 7 × 8?',
  ARRAY['54', '56', '64', '48'], 1),

('Math', 'What is the square root of 144?',
  ARRAY['11', '12', '14', '16'], 1),

('Math', 'What is 15% of 200?',
  ARRAY['15', '25', '30', '35'], 2),

('Math', 'What is the value of pi rounded to 2 decimal places?',
  ARRAY['3.14', '3.15', '3.13', '3.41'], 0),

('Math', 'What is 2 to the power of 10?',
  ARRAY['512', '1024', '2048', '1000'], 1),

('Math', 'If a triangle has angles 90°, 45° and 45°, what type is it?',
  ARRAY['Equilateral', 'Isosceles', 'Scalene', 'Obtuse'], 1),

('Math', 'What is the next prime number after 7?',
  ARRAY['9', '10', '11', '13'], 2),

('Math', 'What is 100 ÷ 4?',
  ARRAY['20', '25', '30', '40'], 1),

('Math', 'What is the sum of the angles in a triangle?',
  ARRAY['90 degrees', '180 degrees', '270 degrees', '360 degrees'], 1),

('Math', 'What is 9 × 9?',
  ARRAY['72', '81', '89', '99'], 1),

-- ============ Football ============
('Football', 'How many players are on a football team on the pitch?',
  ARRAY['10', '11', '12', '9'], 1),

('Football', 'How long is a standard football match?',
  ARRAY['80 minutes', '90 minutes', '100 minutes', '120 minutes'], 1),

('Football', 'Which country has won the most FIFA World Cups?',
  ARRAY['Germany', 'Argentina', 'Brazil', 'Italy'], 2),

('Football', 'What color is a standard red card used for?',
  ARRAY['Red', 'Yellow', 'Orange', 'Blue'], 0),

('Football', 'What is the name of the trophy awarded to the World Cup winner?',
  ARRAY['Golden Ball', 'FIFA Trophy', 'World Cup Trophy', 'Champions Cup'], 2),

('Football', 'How many points does a team get for a win in the league?',
  ARRAY['1', '2', '3', '4'], 2),

('Football', 'What position does a goalkeeper primarily play in?',
  ARRAY['Midfield', 'Attack', 'Defence', 'Goal'], 3),

('Football', 'Which club is known as "The Red Devils"?',
  ARRAY['Liverpool', 'Manchester United', 'Arsenal', 'Chelsea'], 1),

('Football', 'How many substitutes can a team typically make in a match?',
  ARRAY['3', '5', '7', '2'], 1),

('Football', 'What is it called when a player scores three goals in one match?',
  ARRAY['Double', 'Brace', 'Hat-trick', 'Treble'], 2),

-- ============ History ============
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

('History', 'Which ancient wonder stood in Alexandria?',
  ARRAY['Colossus', 'Lighthouse', 'Hanging Gardens', 'Pyramid'], 1),

('History', 'Who painted the Mona Lisa?',
  ARRAY['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], 2);
