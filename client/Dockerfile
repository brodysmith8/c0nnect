# https://docs.docker.com/guides/nodejs/containerize/
FROM node:22.11.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm i 

COPY . .

EXPOSE 5173

ENTRYPOINT ["npm", "run", "dev"]