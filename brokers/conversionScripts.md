Members of the community have also provided scripts to convert export files into the template. These scripts were create and provided by community members and are presented as is, without any guarantee they will work. 

# TopStepX
### Exporting Trades from TopStepX
1. Select the account you wish to export (top-left)
2. Select “Trades” from the bottom pane window
3. Click “export” and choose the Date Range to export

### Python Script
#### Considerations
In order to fit the template, I needed to split 1 line from the TopStepX export into 2 lines (entry / exit) for Import
A trade with a single entry and multiple exits will be listed as 2 lines in the export
In the export, the timezone is reset to UTC ( I needed to change mine to PST what TZ I trade in)

The export provides total commissions, but since I needed to split the entry and exit to TradeNote, I also split the commissions

However, I only logged the Profit/Loss on the exit line of the tradenote import
I manually entered an Account Name

#### Script
````
import pandas as pd
import tkinter as tk
from tkinter import filedialog
import os
import datetime
import sys
import pytz  # Import pytz for timezone conversion

def select_file():
    # Create a Tk root widget
    root = tk.Tk()
    root.withdraw()  # Hide the root window
    # Open a file dialog and get the selected file path
    file_path = filedialog.askopenfilename(title="Select Input File", filetypes=[("CSV files", "*.csv")])
    return file_path

def get_output_filename(base_name):
    # Generate a timestamp
    timestamp = datetime.datetime.now().strftime("_%m-%d-%Y_%H-%M-%S")
    # Create a new filename with timestamp if the file already exists
    new_filename = base_name
    if os.path.exists(new_filename):
        name, ext = os.path.splitext(base_name)
        new_filename = f"{name}{timestamp}{ext}"
    return new_filename

def process_trades(input_file, output_file):
    # Read input data
    df = pd.read_csv(input_file)

    # Ensure correct column names
    df.columns = ['Id', 'ContractName', 'EnteredAt', 'ExitedAt', 'EntryPrice', 'ExitPrice', 'Fees', 'PnL', 'Size', 'Type', 'TradeDay']

    # Define the timezone conversion
    utc = pytz.utc
    pst = pytz.timezone('America/Los_Angeles')

    # Prepare data for output
    processed_data = []
    for index, row in df.iterrows():
        trade_date = pd.to_datetime(row['TradeDay']).strftime('%m/%d/%Y')

        # Convert 'EnteredAt' and 'ExitedAt' to PST
        entry_time_utc = pd.to_datetime(row['EnteredAt']).replace(tzinfo=utc)
        exit_time_utc = pd.to_datetime(row['ExitedAt']).replace(tzinfo=utc)
        entry_time_pst = entry_time_utc.astimezone(pst).strftime('%H:%M:%S')
        exit_time_pst = exit_time_utc.astimezone(pst).strftime('%H:%M:%S')

        # Debugging: Print the row being processed
        print(f"Processing row {index}: {row.tolist()}")

        # Entry execution
        processed_data.append([
            "TopStepX",
            trade_date,
            trade_date,
            "USD",
            0,
            "SS" if row['Type'] == "Short" else "B",
            row['ContractName'],
            row['Size'],
            row['EntryPrice'],
            entry_time_pst,
            row['Fees'] / 2,
            0,
            0,
            0,
            0,
            0,
            0,
            "",  # Gross Proceeds
            "",  # Net Proceeds
            "",  # Clr Broker
            "",  # Liq
            ""   # Note
        ])

        # Exit execution
        processed_data.append([
            "TopStepX",
            trade_date,
            trade_date,
            "USD",
            0,
            "BC" if row['Type'] == "Short" else "S",
            row['ContractName'],
            row['Size'],
            row['ExitPrice'],
            exit_time_pst,
            row['Fees'] / 2,
            0,
            0,
            0,
            0,
            0,
            0,
            row['PnL'],
            row['PnL'] - row['Fees'],
            "",  # Clr Broker
            "",  # Liq
            ""   # Note
        ])

    # Debugging: Check the shape of processed_data
    if processed_data and isinstance(processed_data[0], list):
        num_columns = len(processed_data[0])
        print(f"Number of columns in processed_data: {num_columns}")

    # Convert to DataFrame and save
    try:
        output_df = pd.DataFrame(processed_data, columns=[
            'Account', 'T/D', 'S/D', 'Currency', 'Type', 'Side', 'Symbol', 'Qty', 'Price', 'Exec Time',
            'Comm', 'SEC', 'TAF', 'NSCC', 'Nasdaq', 'ECN Remove', 'ECN Add', 'Gross Proceeds', 'Net Proceeds',
            'Clr Broker', 'Liq', 'Note'
        ])
        output_df.to_csv(output_file, index=False)
        print(f"Data processing complete. Output saved to {output_file}.")
    except Exception as e:
        print(f"Error occurred during data processing: {e}")

if __name__ == "__main__":
    # Prompt the user to select an input file
    input_file = select_file()
    if not input_file:
        print("No file selected. Exiting.")
        sys.exit()

    # Define output filename and append timestamp if necessary
    output_file = get_output_filename("TradeNote_template.csv")

    # Process trades
    process_trades(input_file, output_file)
``


# Warrior Trading SIM
### Exporting Trades from Warrior Trading SIM
1. In Warrior Trading SIM, go to your trading platform
2. Export your trades in the default format (Date,Time,Symbol,Side,Quantity,Price,)
3. Save the file as a .txt or .csv file

### Python Script to Convert to TradeNote Template
#### Considerations
- Warrior Trading SIM exports in a simple format: Date,Time,Symbol,Side,Quantity,Price,
- The script converts this to the TradeNote template format
- Assumes $0 commissions and fees for SIM trading
- Converts 2-digit years (25) to 4-digit years (2025)

#### Script
````python
import csv
import sys
from datetime import datetime

def convert_warrior_sim_to_template(input_file, output_file):
    """
    Convert Warrior Trading SIM export to TradeNote template format
    """
    
    with open(input_file, 'r') as infile, open(output_file, 'w', newline='') as outfile:
        # Write header for TradeNote template
        fieldnames = [
            'Account', 'T/D', 'S/D', 'Currency', 'Type', 'Side', 'Symbol', 'Qty', 'Price', 'Exec Time',
            'Comm', 'SEC', 'TAF', 'NSCC', 'Nasdaq', 'ECN Remove', 'ECN Add', 'Gross Proceeds', 'Net Proceeds',
            'Clr Broker', 'Liq', 'Note'
        ]
        
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        # Process each line from Warrior Trading SIM export
        for line_num, line in enumerate(infile, 1):
            line = line.strip()
            if not line:
                continue
                
            try:
                # Parse the line: Date,Time,Symbol,Side,Quantity,Price,
                parts = line.split(',')
                if len(parts) < 6:
                    print(f"Skipping line {line_num}: insufficient data")
                    continue
                
                date_str = parts[0]
                time_str = parts[1] 
                symbol = parts[2]
                side = parts[3]
                quantity = int(parts[4])
                price = float(parts[5])
                
                # Convert date from MM/DD/YY to MM/DD/YYYY
                date_parts = date_str.split('/')
                if len(date_parts[2]) == 2:
                    year = '20' + date_parts[2]
                else:
                    year = date_parts[2]
                formatted_date = f"{date_parts[0]}/{date_parts[1]}/{year}"
                
                # Calculate gross proceeds
                gross_proceeds = -(quantity * price) if side == 'B' else (quantity * price)
                
                # Write to template format
                writer.writerow({
                    'Account': 'WarriorTradingSIM',
                    'T/D': formatted_date,
                    'S/D': formatted_date,
                    'Currency': 'USD',
                    'Type': 'stock',
                    'Side': side,
                    'Symbol': symbol,
                    'Qty': quantity,
                    'Price': price,
                    'Exec Time': time_str,
                    'Comm': 0,
                    'SEC': 0,
                    'TAF': 0,
                    'NSCC': 0,
                    'Nasdaq': 0,
                    'ECN Remove': 0,
                    'ECN Add': 0,
                    'Gross Proceeds': gross_proceeds,
                    'Net Proceeds': gross_proceeds,  # No fees in SIM
                    'Clr Broker': '',
                    'Liq': '',
                    'Note': ''
                })
                
            except (ValueError, IndexError) as e:
                print(f"Error processing line {line_num}: {e}")
                continue
    
    print(f"Conversion complete. Output saved to {output_file}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python warrior_sim_converter.py <input_file> <output_file>")
        print("Example: python warrior_sim_converter.py trades.txt tradenote_template.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    convert_warrior_sim_to_template(input_file, output_file)
````