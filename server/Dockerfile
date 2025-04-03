# https://docs.docker.com/guides/nodejs/containerize/
FROM node:22.14.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm i 

COPY . .

RUN npm run build

EXPOSE 3000

ENTRYPOINT ["npm", "run", "start"]