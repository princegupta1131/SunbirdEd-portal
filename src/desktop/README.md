
## Prerequisites
  
_The document refers to release version release-6.0.0 [Dt: 11-07-2023]_
- Node >16

## Install dependencies
- Install OpenRAP dependencies

    ```cd OpenRAP && yarn install```

- Packaging OpenRAP folder (tar file)

    ```npm run pack```

- Copy path for ```project-sunbird-OpenRAP-1.0.2.tgz``` generated by above command. File located under ```OpenRAP/dist/```

- Navigate to root folder of desktop application

    ```cd ..```

- Add the OpenRAP packaged file as dependencies in desktop application

    ```yarn add <path-to-tar-file>```

- Install desktop dependencies
 
    ```cd src/desktop && yarn install```

- Update env.json with appropriate credentials

    `In case of local development; devConfig can be used.`

    **PLEASE DO NOT CHECKIN THE DEVCONFIG (OR) DO NOT COMMIT AND PUSH THE DEVCONFIG TO GIT**`

- Copy ```openrap-sunbirded-plugin``` folder to root folder

- [Optional] In case client dependencies are not installed

    - Navigate to src/app/client ; execute the following command to install client dependencies

        ```yarn install```

## Starting Sunbird Desktop Application locally
 
- Open two terminals

    - Under ```src/app/client``` ; run the following command to build the client application

        ```npm run start-desktop (let it run first)```

- Under ```src/desktop``` ; run the following command to build the electron application
    
    ```npm run start```

  
## How to Debug 

- How to debug live installed desktop app?
    
    - We can only debug desktop app backend part by adding various log points in source code and needs to verify logs from logs folder

    - By default only error logs is generated so if you want to also generate debug logs, we have to change replace below line in main.js file

      ```logLevel = 'error' => logLevel = 'debug'```

    - You can also enable developer tools by uncommenting ```win.webContents.openDevTools();``` line from main.js file.

    - You can also open your app in browser using ```http://localhost:{{PortNo}}``` check port no in logs file