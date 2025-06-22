# user input  values
R_per_km = 0.2       # Ohm/km
X_per_km = 0.4        # Ohm/km
line_length_km = 0.65   # km

# P_MW = 256            # MW
# Q_MVar = 110          # MVar

baseMVA = 100      # MVA
baseKV = 138      # kV (line-to-line voltage)

# Step 1: Total line impedance in ohms
R_total = R_per_km * line_length_km
X_total = X_per_km * line_length_km

# Step 2: Base impedance
Z_base = (baseKV  ** 2) / baseMVA# Ohms

# Step 3: Convert to per unit
R_pu = R_total / Z_base
X_pu = X_total / Z_base


# Step 4: Convert load to per unit
#P_pu = P_MW / S_base_MVA
#Q_pu = Q_MVar / S_base_MVA

# # Print results
# print("=== Line Impedance ===")
# print(f"R_total = {R_total:.4f} Ohms")
# print(f"X_total = {X_total:.4f} Ohms")
# print(f"Z_base = {Z_base:.4f} Ohms")
print(f"R (pu) = {R_pu:.6f}")
print(f"X (pu) = {X_pu:.6f}")

# print("\n=== Load Power ===")
# print(f"P (pu) = {P_pu:.4f}")
# print(f"Q (pu) = {Q_pu:.4f}")
