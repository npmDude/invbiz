import swaggerJSDoc from 'swagger-jsdoc';

export const openApiDocument = swaggerJSDoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'InvBiz API',
      version: '0.1.0',
    },
  },
  apis: ['./src/**/*.ts'],
});
