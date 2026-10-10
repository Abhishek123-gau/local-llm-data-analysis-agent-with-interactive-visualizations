from typing import Dict, Any, Tuple, List
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

class DataPrepAgent:
    """Executes verified data remediation actions, builds ColumnTransformer pipeline, and performs train/test splits."""

    def prepare_data(self, df: pd.DataFrame, diagnostics: Dict[str, Any]) -> Dict[str, Any]:
        target_col = diagnostics["target_column"]
        task_type = diagnostics["task_type"]
        columns_to_drop = diagnostics["columns_to_drop"]
        target_remediation = diagnostics["target_remediation"]

        # 1. Clean target nulls
        clean_df = df.copy()
        if target_remediation.get("drop_null_rows"):
            clean_df = clean_df.dropna(subset=[target_col])

        # 2. Extract target y
        raw_y = clean_df[target_col]
        label_encoder = None
        target_classes = None

        if task_type == "classification":
            label_encoder = LabelEncoder()
            y = label_encoder.fit_transform(raw_y.astype(str))
            target_classes = [str(c) for c in label_encoder.classes_]
        else:
            y = pd.to_numeric(raw_y, errors='coerce').fillna(raw_y.median()).values

        # 3. Drop target and verified leakage/ID columns from X
        drop_cols_actual = [c for c in columns_to_drop if c in clean_df.columns]
        drop_cols_actual.append(target_col)
        X_df = clean_df.drop(columns=list(set(drop_cols_actual)))

        if X_df.shape[1] == 0:
            raise ValueError("All features were dropped. Cannot train model without input features.")

        # 4. Identify numeric and categorical columns for pipeline
        num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = X_df.select_dtypes(exclude=[np.number]).columns.tolist()

        transformers = []
        if num_cols:
            num_pipe = Pipeline([
                ('imputer', SimpleImputer(strategy='median')),
                ('scaler', StandardScaler())
            ])
            transformers.append(('num', num_pipe, num_cols))

        if cat_cols:
            cat_pipe = Pipeline([
                ('imputer', SimpleImputer(strategy='most_frequent')),
                ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
            ])
            transformers.append(('cat', cat_pipe, cat_cols))

        preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')
        
        # Fit preprocessor on X
        X_transformed = preprocessor.fit_transform(X_df)

        # Get generated feature names
        feature_names = []
        if num_cols:
            feature_names.extend(num_cols)
        if cat_cols:
            try:
                onehot_obj = preprocessor.named_transformers_['cat'].named_steps['onehot']
                cat_feature_names = onehot_obj.get_feature_names_out(cat_cols)
                feature_names.extend(list(cat_feature_names))
            except Exception:
                feature_names.extend([f"cat_{i}" for i in range(X_transformed.shape[1] - len(num_cols))])

        # Ensure feature names match transformed column count
        if len(feature_names) != X_transformed.shape[1]:
            feature_names = [f"feature_{i}" for i in range(X_transformed.shape[1])]

        # 5. Train / Test Split (80% / 20%)
        stratify_arg = None
        if task_type == "classification" and target_remediation.get("use_stratified_split"):
            # Check minimum class size >= 2 for stratified split
            class_counts = pd.Series(y).value_counts()
            if (class_counts >= 2).all():
                stratify_arg = y

        X_train, X_test, y_train, y_test = train_test_split(
            X_transformed,
            y,
            test_size=0.20,
            random_state=42,
            stratify=stratify_arg
        )

        return {
            "X_train": X_train,
            "X_test": X_test,
            "y_train": y_train,
            "y_test": y_test,
            "num_cols": num_cols,
            "cat_cols": cat_cols,
            "dropped_columns": [c for c in drop_cols_actual if c != target_col],
            "feature_names": feature_names,
            "total_features": len(feature_names),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "preprocessor": preprocessor,
            "label_encoder": label_encoder,
            "target_classes": target_classes,
        }

data_prep_agent = DataPrepAgent()
