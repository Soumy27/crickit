# Calling a ball in every language

Each phrase was spoken by Timbre v3.0, heard by Prisma v3.0 on `indic-auto` with the app's hints, and read by the real parser. Where the first listen gave no ball, the app's second listen in the app's language is applied, with the app assumed to be set to the language under test (marked "2nd listen").

**Result: 80/80. Read it for what it is.** The voice is synthetic, it is one voice, and these same phrases were used to tune the parser (the first run scored 69/80), so this shows the pipeline works per language. It does not predict accuracy with real scorers at a real ground. Translations and vocabulary outside Hindi and English have not been checked by native speakers.

Re-run: `npx tsx --env-file=.env.local scripts/language-matrix.ts`

| Language | Said | Prisma heard | Detected | Wanted | Parsed | OK |
|---|---|---|---|---|---|---|
| hi-IN | चौका | Chauka. | en-IN | Four | Four | yes |
| hi-IN | एक छक्का | एक छक्का। | hi-IN | Six | Six | yes |
| hi-IN | दो रन | 2 run. | en-IN | 2 runs | 2 runs | yes |
| hi-IN | कोई रन नहीं | कोई run नहीं। | hi-IN | Dot ball | Dot ball | yes |
| hi-IN | वाइड गेंद | Wide game. | en-IN | Wide | Wide | yes |
| hi-IN | नो बॉल | No ball. | en-IN | No ball | No ball | yes |
| hi-IN | क्लीन बोल्ड | Clean bowled. | en-IN | Bowled | Bowled | yes |
| hi-IN | कैच आउट | Catch out! | en-IN | Caught | Caught | yes |
| mr-IN | चौकार | Chaukar | en-IN | Four | Four | yes |
| mr-IN | षटकार | षटकार | hi-IN | Six | Six | yes |
| mr-IN | दोन धावा | 2 धावा (2nd listen) | mr-IN | 2 runs | 2 runs | yes |
| mr-IN | धाव नाही | नाव नाही। | mr-IN | Dot ball | Dot ball | yes |
| mr-IN | वाइड चेंडू | wide ball. | en-IN | Wide | Wide | yes |
| mr-IN | नो बॉल | No ball. | en-IN | No ball | No ball | yes |
| mr-IN | त्रिफळाचीत | त्रिफळाचीत (2nd listen) | mr-IN | Bowled | Bowled | yes |
| mr-IN | झेलबाद | झेलबाद | hi-IN | Caught | Caught | yes |
| ta-IN | ஃபோர் | 4 |  | Four | Four | yes |
| ta-IN | ஒரு சிக்ஸர் | ఒక sixer. | en-IN | Six | Six | yes |
| ta-IN | இரண்டு ரன் | 2 run. | en-IN | 2 runs | 2 runs | yes |
| ta-IN | ரன் இல்லை | run இல்லை. | ta-IN | Dot ball | Dot ball | yes |
| ta-IN | வைடு பந்து | wide பந்து. | ta-IN | Wide | Wide | yes |
| ta-IN | நோ பால் | No ball. | en-IN | No ball | No ball | yes |
| ta-IN | கிளீன் போல்ட் | Clean bowled. | en-IN | Bowled | Bowled | yes |
| ta-IN | கேட்ச் அவுட் | Catch out. | en-IN | Caught | Caught | yes |
| te-IN | ఫోర్ | 4 |  | Four | Four | yes |
| te-IN | సిక్సర్ | Sixer | en-IN | Six | Six | yes |
| te-IN | రెండు పరుగులు | 2 పరుగులు. | te-IN | 2 runs | 2 runs | yes |
| te-IN | పరుగులు లేవు | पరుగులు लेवू। | te-IN | Dot ball | Dot ball | yes |
| te-IN | వైడ్ బాల్ | wide ball | en-IN | Wide | Wide | yes |
| te-IN | నో బాల్ | No ball. | en-IN | No ball | No ball | yes |
| te-IN | క్లీన్ బౌల్డ్ | Clean bowled. | en-IN | Bowled | Bowled | yes |
| te-IN | క్యాచ్ అవుట్ | Catch out! | en-IN | Caught | Caught | yes |
| kn-IN | ಫೋರ್ | 4 |  | Four | Four | yes |
| kn-IN | ಸಿಕ್ಸರ್ | Sixer | en-IN | Six | Six | yes |
| kn-IN | ಎರಡು ರನ್ | 2 run. | en-IN | 2 runs | 2 runs | yes |
| kn-IN | ರನ್ ಇಲ್ಲ | रन இல்லை. | ta-IN | Dot ball | Dot ball | yes |
| kn-IN | ವೈಡ್ ಬಾಲ್ | Wide ball. | en-IN | Wide | Wide | yes |
| kn-IN | ನೋ ಬಾಲ್ | No ball. | en-IN | No ball | No ball | yes |
| kn-IN | ಕ್ಲೀನ್ ಬೌಲ್ಡ್ | Clean bowled. | en-IN | Bowled | Bowled | yes |
| kn-IN | ಕ್ಯಾಚ್ ಔಟ್ | Catch out. | en-IN | Caught | Caught | yes |
| ml-IN | ഫോർ | 4 |  | Four | Four | yes |
| ml-IN | സിക്സർ | Sixer. | en-IN | Six | Six | yes |
| ml-IN | രണ്ട് റൺ | 2 run. | en-IN | 2 runs | 2 runs | yes |
| ml-IN | റൺ ഇല്ല | run ഇല്ല. | ml-IN | Dot ball | Dot ball | yes |
| ml-IN | വൈഡ് ബോൾ | wide ball. | en-IN | Wide | Wide | yes |
| ml-IN | നോ ബോൾ | No ball. | en-IN | No ball | No ball | yes |
| ml-IN | ക്ലീൻ ബൗൾഡ് | Clean bowled. | en-IN | Bowled | Bowled | yes |
| ml-IN | ക്യാച്ച് ഔട്ട് | Catch out. | en-IN | Caught | Caught | yes |
| bn-IN | চার রান | चार run। | hi-IN | Four | Four | yes |
| bn-IN | ছক্কা | छक्का | hi-IN | Six | Six | yes |
| bn-IN | দুই রান | 2 run। | en-IN | 2 runs | 2 runs | yes |
| bn-IN | কোনো রান নেই | কোনো রান নেই। | bn-IN | Dot ball | Dot ball | yes |
| bn-IN | ওয়াইড বল | wide ball। | en-IN | Wide | Wide | yes |
| bn-IN | নো বল | No ball. | en-IN | No ball | No ball | yes |
| bn-IN | ক্লিন বোল্ড | Clean bowled. | en-IN | Bowled | Bowled | yes |
| bn-IN | ক্যাচ আউট | Catch out. | en-IN | Caught | Caught | yes |
| gu-IN | ચોગ્ગો | चोग्गो | hi-IN | Four | Four | yes |
| gu-IN | છગ્ગો | छग्गो | hi-IN | Six | Six | yes |
| gu-IN | બે રન | બે run. | gu-IN | 2 runs | 2 runs | yes |
| gu-IN | કોઈ રન નહીં | कोई रन नहीं। | hi-IN | Dot ball | Dot ball | yes |
| gu-IN | વાઇડ બોલ | wide ball | en-IN | Wide | Wide | yes |
| gu-IN | નો બોલ | No ball. | en-IN | No ball | No ball | yes |
| gu-IN | ક્લીન બોલ્ડ | Clean bowled. | en-IN | Bowled | Bowled | yes |
| gu-IN | કેચ આઉટ | catch out। | en-IN | Caught | Caught | yes |
| pa-IN | ਚੌਕਾ | चौका | hi-IN | Four | Four | yes |
| pa-IN | ਛੱਕਾ | छक्का | hi-IN | Six | Six | yes |
| pa-IN | ਦੋ ਦੌੜਾਂ | दो दौड़ा। | hi-IN | 2 runs | 2 runs | yes |
| pa-IN | ਕੋਈ ਦੌੜ ਨਹੀਂ | कोई दौड़ नहीं। | hi-IN | Dot ball | Dot ball | yes |
| pa-IN | ਵਾਈਡ ਗੇਂਦ | wide गेंद। | hi-IN | Wide | Wide | yes |
| pa-IN | ਨੋ ਬਾਲ | No ball। | en-IN | No ball | No ball | yes |
| pa-IN | ਕਲੀਨ ਬੋਲਡ | Clean bowled. | en-IN | Bowled | Bowled | yes |
| pa-IN | ਕੈਚ ਆਊਟ | catch out। | en-IN | Caught | Caught | yes |
| en-IN | Four runs | 4 runs. | en-IN | Four | Four | yes |
| en-IN | That is a six | That is a 6. | en-IN | Six | Six | yes |
| en-IN | Two runs | 2 runs. | en-IN | 2 runs | 2 runs | yes |
| en-IN | No run, dot ball | No run, dot ball. | en-IN | Dot ball | Dot ball | yes |
| en-IN | Wide ball | Wide ball. | en-IN | Wide | Wide | yes |
| en-IN | No ball | No ball. | en-IN | No ball | No ball | yes |
| en-IN | Clean bowled | Clean bowled. | en-IN | Bowled | Bowled | yes |
| en-IN | Caught behind | Caught behind. | en-IN | Caught | Caught | yes |
