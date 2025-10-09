# 1. Base Image: Use a recent, slim Long-Term Support (LTS) version of Node.js
FROM node:20-slim

# 2. Create and set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json to leverage Docker cache
# This step is separate to avoid re-installing dependencies on every code change
COPY package*.json ./

# 4. Install production dependencies
# Using --production flag to avoid installing devDependencies
RUN npm install --production

# 5. Copy the rest of the application source code
COPY . .

# 6. Expose the port the app runs on
EXPOSE 9101

# 7. Define the command to run the application
CMD [ "node", "exporter.js" ]
