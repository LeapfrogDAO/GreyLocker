graph TD
    subgraph "Greylocker Ecosystem"
        GREY[GREY Token] -- Powers --> VaultSystem
        GREY -- Enables --> StakingSystem
        GREY -- Rewards --> DataPools
        GREY -- Slashed by --> DisputeSystem
        
        subgraph "Core Components"
            VaultSystem[Decentralized Identity Vault]
            ZKP[Zero-Knowledge Proofs]
            HESMS[AI Cognitive Agents]
            
            VaultSystem -- Uses --> ZKP
            VaultSystem -- Enhanced by --> HESMS
        end
        
        subgraph "Token Functions"
            StakingSystem -- Four Types --> StakeTypes
            StakingSystem -- Earns --> Rewards
            
            StakeTypes[Security/Service/Validator/Liquidity]
            ServiceProviders -- Register with --> StakingSystem
            ServiceProviders -- Pay --> AccessFees
            DataPools -- Give --> DataRewards
            
            Users -- Earn --> AccessFees
            Users -- Earn --> DataRewards
            Users -- Join --> DataPools
            Users -- Report to --> DisputeSystem
            
            DisputeSystem -- Resolves --> Disputes
            DisputeSystem -- Enforces --> Slashing
        end
        
        subgraph "Governance"
            Parameters[Governance Parameters]
            Roles[Authority Roles]
            
            Parameters -- Controlled by --> Roles
            Parameters -- Configure --> StakingSystem
            Parameters -- Configure --> DataPools
            Parameters -- Configure --> DisputeSystem
        end
    end
    
    subgraph "Technical Implementation"
        Solana[Solana Blockchain]
        Anchor[Anchor Framework]
        SPL[SPL Token Standard]
        
        Solana -- Platform --> Greylocker
        Anchor -- Framework --> Greylocker
        SPL -- Standard --> GREY
        
        Greylocker -- Contains --> Programs
        Programs -- Use --> PDAs
        Programs -- Manage --> TokenAccounts
        
        PDAs[Program Derived Addresses]
        TokenAccounts[Token Accounts]
    end
    
    Greylocker(Greylocker Program)
