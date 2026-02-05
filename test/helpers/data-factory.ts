export const createTestUser = () => {
  const uid = Date.now();

  return {
    email: `test+${uid}@asppibra.com`,
    password: 'SenhaSegura123!',
    firstName: 'Test',
    lastName: 'Admin'
  };
};

export const createTestPost = () => {
  const uid = Date.now();

  return {
    title: 'Inovação Agroecológica em Paraty',
    content: 'Conteúdo detalhado sobre RWA e Café...',
    slug: `inovacao-agro-paraty-${uid}`,
    description: 'Como a ASPPIBRA-DAO lidera a digitalização rural.',
    category: 'Agro',
    publish: true
  };
};