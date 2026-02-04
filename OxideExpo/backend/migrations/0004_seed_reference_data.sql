-- V1 Migration: Seed Reference Data
-- EmpleosInclusivos Infrastructure
-- Contains complete Chilean geographic and industry reference data

-- ============================================================================
-- COUNTRIES
-- ============================================================================

INSERT INTO countries (name, iso_code, phone_code) VALUES
('Chile', 'CL', '+56'),
('Argentina', 'AR', '+54'),
('Peru', 'PE', '+51'),
('Bolivia', 'BO', '+591'),
('Venezuela', 'VE', '+58'),
('Colombia', 'CO', '+57'),
('Ecuador', 'EC', '+593'),
('Brazil', 'BR', '+55'),
('United States', 'US', '+1'),
('Spain', 'ES', '+34'),
('Germany', 'DE', '+49'),
('France', 'FR', '+33'),
('United Kingdom', 'GB', '+44'),
('Italy', 'IT', '+39'),
('Canada', 'CA', '+1'),
('Australia', 'AU', '+61'),
('Mexico', 'MX', '+52'),
('Haiti', 'HT', '+509')
ON CONFLICT (iso_code) DO NOTHING;

-- ============================================================================
-- CHILEAN REGIONS (16 Regions)
-- ============================================================================

WITH chile AS (SELECT id FROM countries WHERE iso_code = 'CL')
INSERT INTO regions (country_id, name, code, sort_order) VALUES
((SELECT id FROM chile), 'Arica y Parinacota', 'XV', 1),
((SELECT id FROM chile), 'Tarapacá', 'I', 2),
((SELECT id FROM chile), 'Antofagasta', 'II', 3),
((SELECT id FROM chile), 'Atacama', 'III', 4),
((SELECT id FROM chile), 'Coquimbo', 'IV', 5),
((SELECT id FROM chile), 'Valparaíso', 'V', 6),
((SELECT id FROM chile), 'Metropolitana de Santiago', 'RM', 7),
((SELECT id FROM chile), 'O''Higgins', 'VI', 8),
((SELECT id FROM chile), 'Maule', 'VII', 9),
((SELECT id FROM chile), 'Ñuble', 'XVI', 10),
((SELECT id FROM chile), 'Biobío', 'VIII', 11),
((SELECT id FROM chile), 'La Araucanía', 'IX', 12),
((SELECT id FROM chile), 'Los Ríos', 'XIV', 13),
((SELECT id FROM chile), 'Los Lagos', 'X', 14),
((SELECT id FROM chile), 'Aysén', 'XI', 15),
((SELECT id FROM chile), 'Magallanes', 'XII', 16)
ON CONFLICT (country_id, name) DO NOTHING;

-- ============================================================================
-- CHILEAN MUNICIPALITIES (COMUNAS) - Major municipalities per region
-- ============================================================================

-- Región Metropolitana
WITH rm AS (SELECT id FROM regions WHERE code = 'RM')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM rm), 'Santiago'),
((SELECT id FROM rm), 'Providencia'),
((SELECT id FROM rm), 'Las Condes'),
((SELECT id FROM rm), 'Vitacura'),
((SELECT id FROM rm), 'La Reina'),
((SELECT id FROM rm), 'Ñuñoa'),
((SELECT id FROM rm), 'Macul'),
((SELECT id FROM rm), 'Peñalolén'),
((SELECT id FROM rm), 'La Florida'),
((SELECT id FROM rm), 'Puente Alto'),
((SELECT id FROM rm), 'San Bernardo'),
((SELECT id FROM rm), 'Maipú'),
((SELECT id FROM rm), 'Cerrillos'),
((SELECT id FROM rm), 'Estación Central'),
((SELECT id FROM rm), 'Quinta Normal'),
((SELECT id FROM rm), 'Renca'),
((SELECT id FROM rm), 'Quilicura'),
((SELECT id FROM rm), 'Huechuraba'),
((SELECT id FROM rm), 'Conchalí'),
((SELECT id FROM rm), 'Independencia'),
((SELECT id FROM rm), 'Recoleta'),
((SELECT id FROM rm), 'San Miguel'),
((SELECT id FROM rm), 'San Joaquín'),
((SELECT id FROM rm), 'La Granja'),
((SELECT id FROM rm), 'La Pintana'),
((SELECT id FROM rm), 'El Bosque'),
((SELECT id FROM rm), 'Pedro Aguirre Cerda'),
((SELECT id FROM rm), 'Lo Espejo'),
((SELECT id FROM rm), 'Cerro Navia'),
((SELECT id FROM rm), 'Pudahuel'),
((SELECT id FROM rm), 'Lo Prado'),
((SELECT id FROM rm), 'Lo Barnechea'),
((SELECT id FROM rm), 'San Ramón'),
((SELECT id FROM rm), 'Colina'),
((SELECT id FROM rm), 'Lampa'),
((SELECT id FROM rm), 'Buin'),
((SELECT id FROM rm), 'Paine'),
((SELECT id FROM rm), 'Melipilla'),
((SELECT id FROM rm), 'Talagante'),
((SELECT id FROM rm), 'Peñaflor'),
((SELECT id FROM rm), 'El Monte'),
((SELECT id FROM rm), 'Padre Hurtado'),
((SELECT id FROM rm), 'Isla de Maipo')
ON CONFLICT (region_id, name) DO NOTHING;

-- Valparaíso Region
WITH val AS (SELECT id FROM regions WHERE code = 'V')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM val), 'Valparaíso'),
((SELECT id FROM val), 'Viña del Mar'),
((SELECT id FROM val), 'Concón'),
((SELECT id FROM val), 'Quilpué'),
((SELECT id FROM val), 'Villa Alemana'),
((SELECT id FROM val), 'Quillota'),
((SELECT id FROM val), 'La Calera'),
((SELECT id FROM val), 'San Antonio'),
((SELECT id FROM val), 'Cartagena'),
((SELECT id FROM val), 'El Quisco'),
((SELECT id FROM val), 'Algarrobo'),
((SELECT id FROM val), 'Casablanca'),
((SELECT id FROM val), 'Los Andes'),
((SELECT id FROM val), 'San Felipe')
ON CONFLICT (region_id, name) DO NOTHING;

-- Biobío Region
WITH bio AS (SELECT id FROM regions WHERE code = 'VIII')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM bio), 'Concepción'),
((SELECT id FROM bio), 'Talcahuano'),
((SELECT id FROM bio), 'Hualpén'),
((SELECT id FROM bio), 'San Pedro de la Paz'),
((SELECT id FROM bio), 'Chiguayante'),
((SELECT id FROM bio), 'Coronel'),
((SELECT id FROM bio), 'Lota'),
((SELECT id FROM bio), 'Tomé'),
((SELECT id FROM bio), 'Penco'),
((SELECT id FROM bio), 'Los Ángeles'),
((SELECT id FROM bio), 'Mulchén'),
((SELECT id FROM bio), 'Nacimiento')
ON CONFLICT (region_id, name) DO NOTHING;

-- La Araucanía Region
WITH ara AS (SELECT id FROM regions WHERE code = 'IX')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM ara), 'Temuco'),
((SELECT id FROM ara), 'Padre Las Casas'),
((SELECT id FROM ara), 'Villarrica'),
((SELECT id FROM ara), 'Pucón'),
((SELECT id FROM ara), 'Angol'),
((SELECT id FROM ara), 'Victoria')
ON CONFLICT (region_id, name) DO NOTHING;

-- Coquimbo Region
WITH coq AS (SELECT id FROM regions WHERE code = 'IV')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM coq), 'La Serena'),
((SELECT id FROM coq), 'Coquimbo'),
((SELECT id FROM coq), 'Ovalle'),
((SELECT id FROM coq), 'Illapel'),
((SELECT id FROM coq), 'Vicuña')
ON CONFLICT (region_id, name) DO NOTHING;

-- O'Higgins Region
WITH ohi AS (SELECT id FROM regions WHERE code = 'VI')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM ohi), 'Rancagua'),
((SELECT id FROM ohi), 'Machalí'),
((SELECT id FROM ohi), 'San Fernando'),
((SELECT id FROM ohi), 'Santa Cruz'),
((SELECT id FROM ohi), 'Rengo')
ON CONFLICT (region_id, name) DO NOTHING;

-- Maule Region
WITH mau AS (SELECT id FROM regions WHERE code = 'VII')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM mau), 'Talca'),
((SELECT id FROM mau), 'Curicó'),
((SELECT id FROM mau), 'Linares'),
((SELECT id FROM mau), 'Constitución'),
((SELECT id FROM mau), 'Cauquenes')
ON CONFLICT (region_id, name) DO NOTHING;

-- Los Lagos Region
WITH lag AS (SELECT id FROM regions WHERE code = 'X')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM lag), 'Puerto Montt'),
((SELECT id FROM lag), 'Puerto Varas'),
((SELECT id FROM lag), 'Osorno'),
((SELECT id FROM lag), 'Castro'),
((SELECT id FROM lag), 'Ancud'),
((SELECT id FROM lag), 'Frutillar')
ON CONFLICT (region_id, name) DO NOTHING;

-- Antofagasta Region
WITH ant AS (SELECT id FROM regions WHERE code = 'II')
INSERT INTO municipalities (region_id, name) VALUES
((SELECT id FROM ant), 'Antofagasta'),
((SELECT id FROM ant), 'Calama'),
((SELECT id FROM ant), 'Tocopilla'),
((SELECT id FROM ant), 'Mejillones'),
((SELECT id FROM ant), 'San Pedro de Atacama')
ON CONFLICT (region_id, name) DO NOTHING;

-- ============================================================================
-- INDUSTRIES
-- ============================================================================

INSERT INTO industries (name, description, sort_order) VALUES
('Tecnología e Informática', 'Desarrollo de software, hardware, telecomunicaciones y servicios digitales', 1),
('Salud y Servicios Médicos', 'Hospitales, clínicas, laboratorios y servicios de salud', 2),
('Educación', 'Instituciones educativas de todos los niveles', 3),
('Minería', 'Extracción y procesamiento de minerales', 4),
('Construcción', 'Edificación, obras civiles e inmobiliarias', 5),
('Retail y Comercio', 'Comercio minorista y mayorista', 6),
('Servicios Financieros', 'Bancos, seguros, inversiones y fintech', 7),
('Manufactura', 'Producción industrial y fabricación', 8),
('Transporte y Logística', 'Transporte de personas y mercancías, almacenamiento', 9),
('Hotelería y Turismo', 'Hoteles, restaurantes y servicios turísticos', 10),
('Agricultura y Agroindustria', 'Producción agrícola, ganadera y procesamiento', 11),
('Energía', 'Generación y distribución de energía, renovables', 12),
('Telecomunicaciones', 'Servicios de telefonía e internet', 13),
('Medios y Comunicación', 'Prensa, radio, televisión y medios digitales', 14),
('Gobierno y Sector Público', 'Organismos estatales y servicios públicos', 15),
('ONGs y Organizaciones Sin Fines de Lucro', 'Organizaciones de beneficencia y desarrollo social', 16),
('Servicios Profesionales', 'Consultoría, legal, contabilidad y otros servicios', 17),
('Entretenimiento y Cultura', 'Artes, espectáculos y recreación', 18),
('Inmobiliaria', 'Corretaje, administración y desarrollo inmobiliario', 19),
('Farmacéutica', 'Investigación, producción y distribución farmacéutica', 20)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- WORK AREAS
-- ============================================================================

INSERT INTO work_areas (name, description, sort_order) VALUES
('Administración y Finanzas', 'Gestión administrativa, contabilidad y finanzas', 1),
('Ventas y Comercial', 'Ventas, desarrollo de negocios y relaciones comerciales', 2),
('Marketing y Comunicaciones', 'Marketing digital, publicidad y comunicación corporativa', 3),
('Recursos Humanos', 'Gestión del talento, reclutamiento y desarrollo organizacional', 4),
('Tecnología de la Información', 'Desarrollo, soporte técnico e infraestructura TI', 5),
('Operaciones y Logística', 'Gestión de operaciones, cadena de suministro', 6),
('Producción y Manufactura', 'Procesos productivos y control de calidad', 7),
('Atención al Cliente', 'Soporte, servicio al cliente y experiencia de usuario', 8),
('Legal', 'Asesoría jurídica y cumplimiento normativo', 9),
('Ingeniería', 'Diseño, desarrollo e implementación técnica', 10),
('Diseño', 'Diseño gráfico, UX/UI y diseño industrial', 11),
('Salud', 'Atención médica, enfermería y servicios de salud', 12),
('Educación y Capacitación', 'Docencia, formación y desarrollo de contenidos', 13),
('Investigación y Desarrollo', 'I+D, innovación y desarrollo de productos', 14),
('Seguridad', 'Seguridad física, digital y prevención de riesgos', 15)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- POSITION LEVELS
-- ============================================================================

INSERT INTO position_levels (name, seniority_rank) VALUES
('Practicante / Pasante', 1),
('Junior / Entry Level', 2),
('Semi-Senior', 3),
('Senior', 4),
('Lead / Team Lead', 5),
('Gerente / Manager', 6),
('Director / Executive', 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- LANGUAGES
-- ============================================================================

INSERT INTO languages (name, iso_code) VALUES
('Español', 'es'),
('Inglés', 'en'),
('Portugués', 'pt'),
('Francés', 'fr'),
('Alemán', 'de'),
('Italiano', 'it'),
('Chino Mandarín', 'zh'),
('Japonés', 'ja'),
('Coreano', 'ko'),
('Árabe', 'ar'),
('Ruso', 'ru'),
('Hindi', 'hi'),
('Mapudungún', NULL),
('Quechua', NULL),
('Aimara', NULL),
('Lengua de Señas Chilena', NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SKILL CATEGORIES
-- ============================================================================

INSERT INTO skill_categories (name, description, sort_order) VALUES
('Habilidades Técnicas', 'Competencias técnicas y especializadas', 1),
('Habilidades Blandas', 'Competencias interpersonales y de comunicación', 2),
('Idiomas', 'Dominio de idiomas extranjeros', 3),
('Herramientas de Software', 'Dominio de aplicaciones y herramientas', 4),
('Metodologías', 'Conocimiento de metodologías y frameworks de trabajo', 5),
('Certificaciones', 'Certificaciones profesionales obtenidas', 6),
('Habilidades de Accesibilidad', 'Competencias relacionadas con inclusión y accesibilidad', 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SKILLS
-- ============================================================================

-- Technical Skills
WITH cat AS (SELECT id FROM skill_categories WHERE name = 'Habilidades Técnicas')
INSERT INTO skills (category_id, name) VALUES
((SELECT id FROM cat), 'JavaScript'),
((SELECT id FROM cat), 'TypeScript'),
((SELECT id FROM cat), 'Python'),
((SELECT id FROM cat), 'Java'),
((SELECT id FROM cat), 'C#'),
((SELECT id FROM cat), 'PHP'),
((SELECT id FROM cat), 'Ruby'),
((SELECT id FROM cat), 'Go'),
((SELECT id FROM cat), 'Rust'),
((SELECT id FROM cat), 'Swift'),
((SELECT id FROM cat), 'Kotlin'),
((SELECT id FROM cat), 'SQL'),
((SELECT id FROM cat), 'HTML/CSS'),
((SELECT id FROM cat), 'React'),
((SELECT id FROM cat), 'Angular'),
((SELECT id FROM cat), 'Vue.js'),
((SELECT id FROM cat), 'Node.js'),
((SELECT id FROM cat), 'Django'),
((SELECT id FROM cat), 'Laravel'),
((SELECT id FROM cat), '.NET'),
((SELECT id FROM cat), 'Spring Boot'),
((SELECT id FROM cat), 'PostgreSQL'),
((SELECT id FROM cat), 'MySQL'),
((SELECT id FROM cat), 'MongoDB'),
((SELECT id FROM cat), 'Redis'),
((SELECT id FROM cat), 'Docker'),
((SELECT id FROM cat), 'Kubernetes'),
((SELECT id FROM cat), 'AWS'),
((SELECT id FROM cat), 'Azure'),
((SELECT id FROM cat), 'Google Cloud'),
((SELECT id FROM cat), 'Git'),
((SELECT id FROM cat), 'CI/CD'),
((SELECT id FROM cat), 'Machine Learning'),
((SELECT id FROM cat), 'Data Analysis'),
((SELECT id FROM cat), 'Business Intelligence'),
((SELECT id FROM cat), 'Cybersecurity'),
((SELECT id FROM cat), 'DevOps'),
((SELECT id FROM cat), 'Mobile Development'),
((SELECT id FROM cat), 'API Development'),
((SELECT id FROM cat), 'Testing/QA')
ON CONFLICT (category_id, name) DO NOTHING;

-- Soft Skills
WITH cat AS (SELECT id FROM skill_categories WHERE name = 'Habilidades Blandas')
INSERT INTO skills (category_id, name) VALUES
((SELECT id FROM cat), 'Comunicación Efectiva'),
((SELECT id FROM cat), 'Trabajo en Equipo'),
((SELECT id FROM cat), 'Liderazgo'),
((SELECT id FROM cat), 'Resolución de Problemas'),
((SELECT id FROM cat), 'Pensamiento Crítico'),
((SELECT id FROM cat), 'Adaptabilidad'),
((SELECT id FROM cat), 'Gestión del Tiempo'),
((SELECT id FROM cat), 'Creatividad'),
((SELECT id FROM cat), 'Empatía'),
((SELECT id FROM cat), 'Negociación'),
((SELECT id FROM cat), 'Atención al Detalle'),
((SELECT id FROM cat), 'Proactividad'),
((SELECT id FROM cat), 'Orientación a Resultados'),
((SELECT id FROM cat), 'Toma de Decisiones'),
((SELECT id FROM cat), 'Inteligencia Emocional')
ON CONFLICT (category_id, name) DO NOTHING;

-- Software Tools
WITH cat AS (SELECT id FROM skill_categories WHERE name = 'Herramientas de Software')
INSERT INTO skills (category_id, name) VALUES
((SELECT id FROM cat), 'Microsoft Office'),
((SELECT id FROM cat), 'Google Workspace'),
((SELECT id FROM cat), 'Slack'),
((SELECT id FROM cat), 'Jira'),
((SELECT id FROM cat), 'Trello'),
((SELECT id FROM cat), 'Notion'),
((SELECT id FROM cat), 'Figma'),
((SELECT id FROM cat), 'Adobe Creative Suite'),
((SELECT id FROM cat), 'SAP'),
((SELECT id FROM cat), 'Salesforce'),
((SELECT id FROM cat), 'HubSpot'),
((SELECT id FROM cat), 'Power BI'),
((SELECT id FROM cat), 'Tableau'),
((SELECT id FROM cat), 'VS Code'),
((SELECT id FROM cat), 'Postman')
ON CONFLICT (category_id, name) DO NOTHING;

-- Methodologies
WITH cat AS (SELECT id FROM skill_categories WHERE name = 'Metodologías')
INSERT INTO skills (category_id, name) VALUES
((SELECT id FROM cat), 'Scrum'),
((SELECT id FROM cat), 'Kanban'),
((SELECT id FROM cat), 'Agile'),
((SELECT id FROM cat), 'Lean'),
((SELECT id FROM cat), 'Design Thinking'),
((SELECT id FROM cat), 'Six Sigma'),
((SELECT id FROM cat), 'Waterfall'),
((SELECT id FROM cat), 'OKRs'),
((SELECT id FROM cat), 'ITIL')
ON CONFLICT (category_id, name) DO NOTHING;

-- Accessibility Skills
WITH cat AS (SELECT id FROM skill_categories WHERE name = 'Habilidades de Accesibilidad')
INSERT INTO skills (category_id, name) VALUES
((SELECT id FROM cat), 'WCAG / Accesibilidad Web'),
((SELECT id FROM cat), 'Diseño Universal'),
((SELECT id FROM cat), 'Tecnologías de Asistencia'),
((SELECT id FROM cat), 'Lengua de Señas'),
((SELECT id FROM cat), 'Comunicación Aumentativa'),
((SELECT id FROM cat), 'Braille'),
((SELECT id FROM cat), 'Accesibilidad Cognitiva')
ON CONFLICT (category_id, name) DO NOTHING;
